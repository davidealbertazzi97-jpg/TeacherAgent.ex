const { describe, expect, it, beforeAll, afterAll } = require('bun:test');
const { startAgentBroker, getAgentBridgeConfig, stopAgentBroker } = require('./agent-broker');

describe('Electron Desktop Agent Broker', () => {
    beforeAll(async () => {
        await startAgentBroker();
    });

    afterAll(() => {
        stopAgentBroker();
    });

    it('allocates a dynamic free port and generates a cryptographically secure token', () => {
        const config = getAgentBridgeConfig('test-project-123');
        expect(config).not.toBeNull();
        expect(config.wsUrl).toMatch(/^ws:\/\/127\.0\.0\.1:\d+\/agent-bridge$/);
        expect(config.token).not.toBeNull();
        expect(config.token.length).toBe(36); // UUID format
        expect(config.projectId).toBe('test-project-123');
    });

    it('rejects connection if the secure token is missing or incorrect', (done) => {
        const config = getAgentBridgeConfig('test-project-123');
        const url = config.wsUrl;
        
        // Attempt connect without token
        const wsNoToken = new WebSocket(`${url}?role=client&projectId=test-project-123`);
        wsNoToken.onclose = (event) => {
            // Rejected immediately (Node.js http upgrades close raw socket or return 400 Bad Request)
            done();
        };
    });

    it('rejects connection if the role is invalid', (done) => {
        const config = getAgentBridgeConfig('test-project-123');
        const url = config.wsUrl;
        
        // Attempt connect with invalid role
        const wsBadRole = new WebSocket(`${url}?role=bad&projectId=test-project-123&token=${config.token}`);
        wsBadRole.onclose = () => {
            done();
        };
    });

    it('accepts connections with correct parameters and relays JSON-RPC messages loopback', (done) => {
        const config = getAgentBridgeConfig('test-project-relay');
        const url = config.wsUrl;
        const token = config.token;

        const clientWs = new WebSocket(`${url}?role=client&projectId=test-project-relay&token=${token}`);
        const agentWs = new WebSocket(`${url}?role=agent&projectId=test-project-relay&token=${token}`);

        let clientConnected = false;
        let agentConnected = false;

        const checkRelay = () => {
            if (clientConnected && agentConnected) {
                // Agent sends tool.call, client should receive
                const call = { type: 'tool.call', id: 'call-xyz', tool: 'create_page', args: { title: 'Chapter' } };
                agentWs.send(JSON.stringify(call));
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
            expect(msg.tool).toBe('create_page');

            // Send back result
            const result = { type: 'tool.result', id: 'call-xyz', ok: true, result: { pageId: 'p-1' } };
            clientWs.send(JSON.stringify(result));
        };

        agentWs.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            expect(msg.type).toBe('tool.result');
            expect(msg.ok).toBe(true);

            clientWs.close();
            agentWs.close();
            done();
        };
    });
});
