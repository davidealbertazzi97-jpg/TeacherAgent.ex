import { describe, expect, it, beforeAll, afterAll } from 'bun:test';
import { Elysia } from 'elysia';
import { agentBridgeRoutes, agentSessionToken } from './agent-bridge';

describe('Elysia WebSocket Relay Bridge', () => {
    let server: any;
    const port = 3015;

    beforeAll(() => {
        // Spin up a test server on a dedicated test port
        const app = new Elysia().use(agentBridgeRoutes);
        server = app.listen(port);
    });

    afterAll(() => {
        server.stop();
    });

    it('exposes the session token securely via HTTP GET /api/agent-token', async () => {
        const res = await fetch(`http://localhost:${port}/api/agent-token`);
        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data.token).toBe(agentSessionToken);
    });

    it('rejects WebSocket connection if the session token is missing', (done) => {
        const ws = new WebSocket(`ws://localhost:${port}/agent-bridge?role=client&projectId=test-p`);
        ws.onclose = (event) => {
            // WS connection should be rejected due to missing parameters
            expect(event.code).toBe(4000);
            done();
        };
    });

    it('rejects WebSocket connection if the session token is invalid', (done) => {
        const ws = new WebSocket(`ws://localhost:${port}/agent-bridge?role=client&projectId=test-p&token=wrong-token`);
        ws.onclose = (event) => {
            // WS connection should be rejected due to invalid token
            expect(event.code).toBe(4003);
            done();
        };
    });

    it('accepts connections with valid session tokens and relays messages between client and agent', (done) => {
        const clientWs = new WebSocket(`ws://localhost:${port}/agent-bridge?role=client&projectId=test-p-relay&token=${agentSessionToken}`);
        const agentWs = new WebSocket(`ws://localhost:${port}/agent-bridge?role=agent&projectId=test-p-relay&token=${agentSessionToken}`);

        let clientConnected = false;
        let agentConnected = false;

        const checkRelay = () => {
            if (clientConnected && agentConnected) {
                // Agent sends tool.call, Client should receive it
                const toolCall = { type: 'tool.call', id: 'call-1', tool: 'read_project_structure', args: {} };
                agentWs.send(JSON.stringify(toolCall));
            }
        };

        clientWs.onopen = () => {
            clientConnected = true;
            checkRelay();
        };

        agentWs.onopen = () => {
            agentConnected = true;
            checkRelay();
        };

        clientWs.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            expect(msg.type).toBe('tool.call');
            expect(msg.tool).toBe('read_project_structure');

            // Client responds with result, Agent should receive it
            const toolResult = { type: 'tool.result', id: 'call-1', ok: true, result: { pages: [] } };
            clientWs.send(JSON.stringify(toolResult));
        };

        agentWs.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            console.log("AGENT RECEIVED MESSAGE:", msg);
            expect(msg.type).toBe('tool.result');
            expect(msg.ok).toBe(true);

            // Clean up and finish
            clientWs.close();
            agentWs.close();
            done();
        };
    });
});
