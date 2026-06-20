const ws = require('ws');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

let wss = null;
let server = null;
let agentSessionToken = null;
let activePort = null;

const rooms = new Map(); // projectId -> { client, agents: Set }

/**
 * Automatically update the bridge-config.json discovery file inside the workspace.
 */
function updateBridgeConfig() {
    if (!activePort || !agentSessionToken) {
        return;
    }
    try {
        const configPath = path.join(__dirname, 'bridge-config.json');
        const activeProjects = Array.from(rooms.keys()).filter(id => rooms.get(id).client !== null);
        const host = process.env.EXE_AGENT_BROKER_HOST || '127.0.0.1';
        const configData = {
            wsUrl: `ws://${host}:${activePort}/agent-bridge`,
            token: agentSessionToken,
            projectId: activeProjects[0] || 'default-project',
            activeProjects: activeProjects
        };
        fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), 'utf8');
        console.log(`[AgentBroker] Updated bridge config at ${configPath} (active projects: ${activeProjects.join(', ')})`);
    } catch (e) {
        console.error(`[AgentBroker] Failed to update bridge config: ${e.message}`);
    }
}

/**
 * Start local WebSocket broker for the desktop app.
 * Binds to port 0 to allocate any free dynamic port on localhost loopback.
 * Returns a Promise resolving when the server is fully bound and listening.
 */
function startAgentBroker() {
    return new Promise((resolve) => {
        agentSessionToken = crypto.randomUUID();
        
        server = http.createServer((req, res) => {
            res.writeHead(404);
            res.end();
        });
        
        wss = new ws.WebSocketServer({ noServer: true });
        
        server.on('upgrade', (request, socket, head) => {
            const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
            if (url.pathname !== '/agent-bridge') {
                socket.destroy();
                return;
            }
            
            const role = url.searchParams.get('role');
            const projectId = url.searchParams.get('projectId');
            const token = url.searchParams.get('token');
            
            if (!projectId || !role || !token) {
                socket.write('HTTP/1.1 400 Bad Request\r\n\r\nMissing parameters');
                socket.destroy();
                return;
            }
            
            if (role !== 'client' && role !== 'agent') {
                socket.write('HTTP/1.1 400 Bad Request\r\n\r\nInvalid role');
                socket.destroy();
                return;
            }
            
            if (token !== agentSessionToken) {
                socket.write('HTTP/1.1 401 Unauthorized\r\n\r\nInvalid session token');
                socket.destroy();
                return;
            }
            
            wss.handleUpgrade(request, socket, head, (wsConn) => {
                wss.emit('connection', wsConn, request, { role, projectId });
            });
        });
        
        wss.on('connection', (wsConn, request, { role, projectId }) => {
            console.log(`[AgentBroker] Secure desktop connection: role=${role}, projectId=${projectId}`);
            
            let room = rooms.get(projectId);
            if (!room) {
                room = { client: null, agents: new Set() };
                rooms.set(projectId, room);
            }
            
            if (role === 'client') {
                room.client = wsConn;
                updateBridgeConfig();
            } else if (role === 'agent') {
                room.agents.add(wsConn);
            }
            
            wsConn.on('message', (message, isBinary) => {
                const roomData = rooms.get(projectId);
                if (!roomData) return;
                
                const msgStr = isBinary ? message : message.toString();
                
                // Limit message dimension to 2MB
                if (msgStr.length > 2 * 1024 * 1024) {
                    wsConn.send(JSON.stringify({ type: 'error', error: 'Message size limit exceeded (2MB max)' }));
                    return;
                }
                
                // Validate JSON format
                let parsed;
                try {
                    parsed = JSON.parse(msgStr);
                } catch (e) {
                    wsConn.send(JSON.stringify({ type: 'error', error: 'Invalid JSON format' }));
                    return;
                }
                
                if (!parsed || typeof parsed !== 'object' || !parsed.type) {
                    wsConn.send(JSON.stringify({ type: 'error', error: 'Invalid message type schema' }));
                    return;
                }
                
                // Broadcast relay logic
                if (role === 'agent') {
                    if (roomData.client && roomData.client.readyState === ws.OPEN) {
                        roomData.client.send(msgStr);
                    }
                } else if (role === 'client') {
                    for (const agent of roomData.agents) {
                        if (agent.readyState === ws.OPEN) {
                            agent.send(msgStr);
                        }
                    }
                }
            });
            
            wsConn.on('close', () => {
                const roomData = rooms.get(projectId);
                if (!roomData) return;
                
                if (role === 'client') {
                    if (roomData.client === wsConn) {
                        roomData.client = null;
                        updateBridgeConfig();
                    }
                } else if (role === 'agent') {
                    roomData.agents.delete(wsConn);
                }
                
                if (!roomData.client && roomData.agents.size === 0) {
                    rooms.delete(projectId);
                }
                
                console.log(`[AgentBroker] Connection closed: role=${role}, projectId=${projectId}`);
            });
        });
        
        const host = process.env.EXE_AGENT_BROKER_HOST || '127.0.0.1';
        server.listen(0, host, () => {
            activePort = server.address().port;
            console.log(`[AgentBroker] Desktop agent broker active on ${host}:${activePort}`);
            updateBridgeConfig();
            resolve();
        });
    });
}

/**
 * Returns active connection parameters.
 */
function getAgentBridgeConfig(projectId = 'default-project') {
    if (!activePort || !agentSessionToken) {
        return null;
    }
    const host = process.env.EXE_AGENT_BROKER_HOST || '127.0.0.1';
    return {
        wsUrl: `ws://${host}:${activePort}/agent-bridge`,
        token: agentSessionToken,
        projectId: projectId
    };
}

/**
 * Stop local WS broker.
 */
function stopAgentBroker() {
    if (wss) {
        wss.close();
        wss = null;
    }
    if (server) {
        server.close();
        server = null;
    }
    activePort = null;
    agentSessionToken = null;
    rooms.clear();

    try {
        const configPath = path.join(__dirname, 'bridge-config.json');
        if (fs.existsSync(configPath)) {
            fs.unlinkSync(configPath);
            console.log(`[AgentBroker] Cleaned up bridge config at ${configPath}`);
        }
    } catch (e) {
        console.error(`[AgentBroker] Failed to remove bridge config during shutdown: ${e.message}`);
    }
}

module.exports = {
    startAgentBroker,
    getAgentBridgeConfig,
    stopAgentBroker
};
