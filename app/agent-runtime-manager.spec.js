const { describe, expect, it, beforeAll, afterAll } = require('bun:test');
const { listAgentRuntimes, startAgentRuntime, stopAgentRuntime, COMMAND_ALLOWLIST } = require('./agent-runtime-manager');
const { startAgentBroker, stopAgentBroker } = require('./agent-broker');

describe('Desktop Agent Runtime Manager', () => {
    beforeAll(async () => {
        // Start the broker to seed bridge configs
        await startAgentBroker();
    });

    afterAll(() => {
        stopAgentBroker();
        stopAgentRuntime();
    });

    it('defines a strict command allowlist', () => {
        expect(COMMAND_ALLOWLIST).toContain('opencode');
        expect(COMMAND_ALLOWLIST).toContain('/home/asus/.opencode/bin/opencode');
    });

    it('lists available agent runtimes correctly', () => {
        const runtimes = listAgentRuntimes();
        expect(runtimes).toHaveLength(1);
        expect(runtimes[0].id).toBe('opencode');
        expect(runtimes[0].name).toBe('OpenCode CLI');
        expect(runtimes[0].path).toBe('/home/asus/.opencode/bin/opencode');
    });

    it('validates only opencode as runtime in this milestone', () => {
        expect(() => {
            startAgentRuntime({ runtime: 'unsupported-agent', projectId: 'p-1', prompt: 'Goal' });
        }).toThrow(/not allowed or supported/);
    });

    it('scrubs the process environment and allows only standard keys + agent params', () => {
        // Spying child_process.spawn to inspect the scrubbed environment options
        const childProcess = require('child_process');
        const originalSpawn = childProcess.spawn;

        let capturedOptions = null;
        
        childProcess.spawn = (binary, args, options) => {
            capturedOptions = options;
            return {
                stdin: { write: () => {} },
                stdout: { on: () => {} },
                stderr: { on: () => {} },
                on: () => {},
                kill: () => {}
            };
        };

        // Seed dirty environment with keys that must be scrubbed
        process.env.OPENAI_API_KEY = 'secret-api-key-xyz';
        process.env.AWS_SECRET_ACCESS_KEY = 'secret-aws-key-123';

        // Trigger startAgentRuntime
        startAgentRuntime({ runtime: 'opencode', projectId: 'test-projectId', prompt: 'Teach Volcanoes' });

        // Restore spawn
        childProcess.spawn = originalSpawn;

        // Clean dirty envs
        delete process.env.OPENAI_API_KEY;
        delete process.env.AWS_SECRET_ACCESS_KEY;

        expect(capturedOptions).not.toBeNull();
        const capturedEnv = capturedOptions.env;

        // Verify secret keys are fully scrubbed and missing
        expect(capturedEnv.OPENAI_API_KEY).toBeUndefined();
        expect(capturedEnv.AWS_SECRET_ACCESS_KEY).toBeUndefined();

        // Verify agent secure credentials are fully populated
        expect(capturedEnv.EXE_AGENT_WS_URL).toBeDefined();
        expect(capturedEnv.EXE_AGENT_TOKEN).toBeDefined();
        expect(capturedEnv.EXE_AGENT_PROJECT_ID).toBe('test-projectId');
        expect(capturedEnv.EXE_AGENT_PROMPT).toBe('Teach Volcanoes');
        
        // Clean active process reference
        stopAgentRuntime();
    });

    it('spawns the WebSocket adapter instead of raw OpenCode so the agent actually connects to eXeLearning', () => {
        const childProcess = require('child_process');
        const originalSpawn = childProcess.spawn;

        let capturedBinary = null;
        let capturedArgs = null;
        let capturedOptions = null;

        childProcess.spawn = (binary, args, options) => {
            capturedBinary = binary;
            capturedArgs = args;
            capturedOptions = options;
            return {
                stdin: { write: () => {} },
                stdout: { on: () => {} },
                stderr: { on: () => {} },
                on: () => {},
                kill: () => {}
            };
        };

        startAgentRuntime({ runtime: 'opencode', projectId: 'p-arg', prompt: 'Build a memory game' });
        childProcess.spawn = originalSpawn;

        expect(capturedBinary).toBe(process.execPath);
        expect(capturedArgs[0]).toContain('opencode-ws-adapter.js');
        expect(capturedOptions.env.EXE_AGENT_PROMPT).toBe('Build a memory game');
        expect(capturedOptions.env.EXE_AGENT_OPENCODE_BIN).toContain('opencode');
        expect(capturedOptions.env.ELECTRON_RUN_AS_NODE).toBe('1');

        stopAgentRuntime();
    });

    it('gracefully kills active process on stopAgentRuntime', () => {
        const childProcess = require('child_process');
        const originalSpawn = childProcess.spawn;

        let killCalledSignal = null;

        childProcess.spawn = () => {
            return {
                stdin: { write: () => {} },
                stdout: { on: () => {} },
                stderr: { on: () => {} },
                on: () => {},
                kill: (sig) => {
                    killCalledSignal = sig;
                }
            };
        };

        startAgentRuntime({ runtime: 'opencode', projectId: 'p-1', prompt: 'Goal' });
        
        const stopResult = stopAgentRuntime();

        childProcess.spawn = originalSpawn;

        expect(stopResult).toBe(true);
        expect(killCalledSignal).toBe('SIGTERM');
    });
});
