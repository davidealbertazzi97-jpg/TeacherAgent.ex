import { Elysia } from 'elysia';
import { randomUUID } from 'crypto';

interface BridgeRoom {
  client: any; // The browser eXeLearning client connection
  agents: Set<any>; // The connected external AI coding agents (or fake agents)
}

const rooms = new Map<string, BridgeRoom>();

// Generate a secure session token unique to this server instance
export const agentSessionToken = randomUUID();

/**
 * WebSocket Agent Bridge Routes for Elysia/Bun.
 * Relays JSON-RPC tool calls from the external agent to the editor client
 * and forwards results and logs back securely with session validation.
 */
export const agentBridgeRoutes = new Elysia({ name: 'agent-bridge-routes' })
  .get('/api/agent-token', () => {
    return { token: agentSessionToken };
  })
  .ws('/agent-bridge', {
    open(ws) {
      const query = ws.data.query as Record<string, string>;
      const role = query.role;
      const projectId = query.projectId;
      const token = query.token;

      if (!projectId || !role || !token) {
        ws.close(4000, 'Missing role, projectId or token parameters');
        return;
      }

      if (role !== 'client' && role !== 'agent') {
        ws.close(4001, 'Invalid role');
        return;
      }

      if (token !== agentSessionToken) {
        ws.close(4003, 'Invalid session token');
        return;
      }

      console.log(`[AgentBridge] Client connected securely: role=${role}, projectId=${projectId}`);

      let room = rooms.get(projectId);
      if (!room) {
        room = { client: null, agents: new Set() };
        rooms.set(projectId, room);
      }

      if (role === 'client') {
        room.client = ws;
      } else if (role === 'agent') {
        room.agents.add(ws);
      }
    },

    message(ws, message) {
      const query = ws.data.query as Record<string, string>;
      const role = query.role;
      const projectId = query.projectId;
      const token = query.token;

      if (!projectId || !role || token !== agentSessionToken) {
        ws.close(4003, 'Unauthorized');
        return;
      }

      const room = rooms.get(projectId);
      if (!room) return;

      let parsed: any;
      let forwardPayload: string;

      // Handle cases where Bun/Elysia pre-parses the message into a JSON object
      if (typeof message === 'object' && message !== null && !(message instanceof ArrayBuffer) && !(message instanceof Uint8Array) && !Buffer.isBuffer(message)) {
        parsed = message;
        forwardPayload = JSON.stringify(message);
      } else {
        let msgStr: string;
        if (typeof message === 'string') {
          msgStr = message;
        } else if (message instanceof ArrayBuffer) {
          msgStr = new TextDecoder().decode(message);
        } else if (message instanceof Uint8Array || Buffer.isBuffer(message)) {
          msgStr = Buffer.from(message).toString();
        } else {
          msgStr = message.toString();
        }

        // Enforce maximum dimension (2MB cap)
        if (msgStr.length > 2 * 1024 * 1024) {
          ws.send(JSON.stringify({ type: 'error', error: 'Message size limit exceeded (2MB max)' }));
          return;
        }

        try {
          parsed = JSON.parse(msgStr);
        } catch (e) {
          ws.send(JSON.stringify({ type: 'error', error: 'Invalid JSON format' }));
          return;
        }
        forwardPayload = msgStr;
      }

      if (!parsed || typeof parsed !== 'object') {
        ws.send(JSON.stringify({ type: 'error', error: 'Message must be a valid JSON object' }));
        return;
      }

      if (!parsed.type) {
        ws.send(JSON.stringify({ type: 'error', error: 'Missing message type' }));
        return;
      }

      // JSON-RPC tool.call scheme validation
      if (parsed.type === 'tool.call') {
        if (!parsed.id || typeof parsed.tool !== 'string' || (parsed.args !== undefined && typeof parsed.args !== 'object')) {
          ws.send(JSON.stringify({ type: 'error', error: 'Invalid tool.call schema: must contain id, tool (string) and optional args (object)' }));
          return;
        }
      }

      // JSON-RPC tool.result schema validation
      if (parsed.type === 'tool.result') {
        if (!parsed.id || parsed.ok === undefined) {
          ws.send(JSON.stringify({ type: 'error', error: 'Invalid tool.result schema: must contain id and ok (boolean)' }));
          return;
        }
      }

      // Broadcast relay logic
      if (role === 'agent') {
        // Forward tool.call or chat messages from agent to browser client
        if (room.client && room.client.readyState === 1) {
          room.client.send(forwardPayload);
        }
      } else if (role === 'client') {
        // Forward tool.result or user chat messages from browser client to all agents
        for (const agent of room.agents) {
          if (agent.readyState === 1) {
            agent.send(forwardPayload);
          }
        }
      }
    },

    close(ws) {
      const query = ws.data.query as Record<string, string>;
      const role = query.role;
      const projectId = query.projectId;

      if (!projectId) return;
      const room = rooms.get(projectId);
      if (!room) return;

      if (role === 'client') {
        if (room.client === ws) {
          room.client = null;
        }
      } else if (role === 'agent') {
        room.agents.delete(ws);
      }

      // Cleanup room if empty
      if (!room.client && room.agents.size === 0) {
        rooms.delete(projectId);
      }

      console.log(`[AgentBridge] Client disconnected: role=${role}, projectId=${projectId}`);
    }
  });
