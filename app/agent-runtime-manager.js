const child_process = require('child_process');
const fs = require('fs');
const path = require('path');
const { getAgentBridgeConfig } = require('./agent-broker');

let activeProcess = null;

// Command allowlist constraint
const COMMAND_ALLOWLIST = [
    'opencode',
    '/home/asus/.opencode/bin/opencode'
];

/**
 * Checks if a command exists in the host system.
 */
function isCommandAvailable(command) {
    try {
        if (path.isAbsolute(command)) {
            return fs.existsSync(command);
        }
        // standard Linux command-v checks
        child_process.execSync(`command -v ${command}`, { stdio: 'ignore' });
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * List the available agent runtimes on the host.
 */
function listAgentRuntimes() {
    const runtimes = [
        {
            id: 'opencode',
            name: 'OpenCode CLI',
            path: '/home/asus/.opencode/bin/opencode',
            available: false
        }
    ];

    if (isCommandAvailable('/home/asus/.opencode/bin/opencode') || isCommandAvailable('opencode')) {
        runtimes[0].available = true;
    }

    return runtimes;
}

/**
 * Spawn the coding agent process securely.
 */
function startAgentRuntime({ runtime, projectId, prompt }, onOutput, onClose) {
    if (runtime !== 'opencode') {
        throw new Error(`Agent runtime "${runtime}" is not allowed or supported in this milestone.`);
    }

    if (activeProcess) {
        throw new Error('An active agent runtime is already running. Stop it first.');
    }

    // Enforce allowed binary search paths
    let binary = 'opencode';
    if (isCommandAvailable('/home/asus/.opencode/bin/opencode')) {
        binary = '/home/asus/.opencode/bin/opencode';
    } else if (isCommandAvailable('opencode')) {
        binary = 'opencode';
    } else {
        throw new Error('OpenCode CLI binary not found on the host system.');
    }

    // Retrieve dynamic websocket bridge loopback configurations
    const config = getAgentBridgeConfig(projectId);
    if (!config) {
        throw new Error('Desktop agent broker not active. Connect the bridge first.');
    }

    const { wsUrl, token } = config;

    // Environmental variables scrubbing
    const scrubbedEnv = {};
    const allowedEnvKeys = ['PATH', 'HOME', 'USER', 'SHELL', 'LANG', 'LC_ALL'];
    for (const key of allowedEnvKeys) {
        if (process.env[key]) {
            scrubbedEnv[key] = process.env[key];
        }
    }
    scrubbedEnv['EXE_AGENT_WS_URL'] = wsUrl;
    scrubbedEnv['EXE_AGENT_TOKEN'] = token;
    scrubbedEnv['EXE_AGENT_PROJECT_ID'] = projectId;
    scrubbedEnv['EXE_AGENT_PROMPT'] = prompt;
    scrubbedEnv['EXE_AGENT_OPENCODE_BIN'] = binary;
    scrubbedEnv['EXE_AGENT_WORKDIR'] = '/home/asus/exelearning-code';
    scrubbedEnv['ELECTRON_RUN_AS_NODE'] = '1';

    const adapterPath = path.join(__dirname, 'opencode-ws-adapter.js');

    console.log(`[RuntimeManager] Spawning OpenCode WebSocket adapter for projectId: ${projectId}`);

    activeProcess = child_process.spawn(process.execPath, [adapterPath], {
        cwd: '/home/asus/exelearning-code',
        env: scrubbedEnv
    });

    // Capture stdout and stderr stream logs
    activeProcess.stdout.on('data', (data) => {
        if (onOutput) onOutput(data.toString(), 'stdout');
    });

    activeProcess.stderr.on('data', (data) => {
        if (onOutput) onOutput(data.toString(), 'stderr');
    });

    activeProcess.on('close', (code) => {
        console.log(`[RuntimeManager] Agent runtime exited with code: ${code}`);
        activeProcess = null;
        if (onClose) onClose(code);
    });

    activeProcess.on('error', (err) => {
        console.error('[RuntimeManager] Agent process error:', err);
        activeProcess = null;
        if (onClose) onClose(-1, err.message);
    });

    return true;
}

/**
 * Gracefully kill the active agent runtime process.
 */
function stopAgentRuntime() {
    if (!activeProcess) {
        return false;
    }
    console.log('[RuntimeManager] Stop command issued. Killing active agent process...');
    activeProcess.kill('SIGTERM');
    
    // Hard fallback SIGKILL after 1s if still alive
    const proc = activeProcess;
    setTimeout(() => {
        try {
            if (proc) proc.kill('SIGKILL');
        } catch (_) {}
    }, 1000);

    activeProcess = null;
    return true;
}

module.exports = {
    listAgentRuntimes,
    startAgentRuntime,
    stopAgentRuntime,
    COMMAND_ALLOWLIST
};
