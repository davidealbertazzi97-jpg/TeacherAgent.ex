const ws = require('ws');
const http = require('http');
const crypto = require('crypto');

let wss = null;
let server = null;
let agentSessionToken = null;
let activePort = null;

const rooms = new Map(); // projectId -> { client, agents: Set }

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
        
        // Bind to 127.0.0.1 loopback only for local secure IPC
        server.listen(0, '127.0.0.1', () => {
            activePort = server.address().port;
            console.log(`[AgentBroker] Local desktop agent broker active on 127.0.0.1:${activePort}`);
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
    return {
        wsUrl: `ws://127.0.0.1:${activePort}/agent-bridge`,
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
}

module.exports = {
    startAgentBroker,
    getAgentBridgeConfig,
    stopAgentBroker
};
