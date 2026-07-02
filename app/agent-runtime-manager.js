const child_process = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { getAgentBridgeConfig } = require('./agent-broker');

let activeProcess = null;

/**
 * Returns the resolved path to the OpenCode binary on the host system.
 */
function getOpenCodePath() {
    const base = path.join(os.homedir(), '.opencode', 'bin');
    const extensions = ['', '.cmd', '.bat', '.exe'];
    for (const ext of extensions) {
        const fullPath = path.join(base, 'opencode' + ext);
        if (fs.existsSync(fullPath)) {
            return fullPath;
        }
    }
    return path.join(os.homedir(), '.opencode', 'bin', process.platform === 'win32' ? 'opencode.cmd' : 'opencode');
}

/**
 * Returns the resolved path to the Goose binary on the host system.
 */
function getGoosePath() {
    const base = path.join(os.homedir(), '.local', 'bin');
    const extensions = ['', '.exe', '.cmd', '.bat'];
    for (const ext of extensions) {
        const fullPath = path.join(base, 'goose' + ext);
        if (fs.existsSync(fullPath)) {
            return fullPath;
        }
    }
    return path.join(os.homedir(), '.local', 'bin', process.platform === 'win32' ? 'goose.exe' : 'goose');
}

// Command allowlist constraint
const COMMAND_ALLOWLIST = [
    'opencode',
    getOpenCodePath(),
    'codex',
    'claude',
    'goose',
    getGoosePath(),
    'qwen',
    'antigravity',
    'custom'
];

/**
 * Checks if a command exists in the host system.
 */
function isCommandAvailable(command) {
    try {
        if (path.isAbsolute(command)) {
            return fs.existsSync(command);
        }
        if (process.platform === 'win32') {
            child_process.execSync(`where ${command}`, { stdio: 'ignore' });
        } else {
            child_process.execSync(`command -v ${command}`, { stdio: 'ignore' });
        }
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * List the available agent runtimes on the host.
 */
function listAgentRuntimes() {
    const openCodePath = getOpenCodePath();
    const goosePath = getGoosePath();

    const runtimes = [
        {
            id: 'opencode',
            name: 'OpenCode CLI',
            path: openCodePath,
            available: false
        },
        {
            id: 'codex',
            name: 'Codex CLI',
            path: 'codex',
            available: false
        },
        {
            id: 'claude',
            name: 'Claude Code',
            path: 'claude',
            available: false
        },
        {
            id: 'goose',
            name: 'Goose CLI (Esterno)',
            path: goosePath,
            available: false
        },
        {
            id: 'qwen',
            name: 'Qwen Coder CLI',
            path: 'qwen',
            available: false
        },
        {
            id: 'antigravity',
            name: 'Antigravity CLI',
            path: 'antigravity',
            available: false
        },
        {
            id: 'custom',
            name: 'Custom Command',
            path: 'custom',
            available: true
        }
    ];

    if (isCommandAvailable(openCodePath) || isCommandAvailable('opencode')) {
        runtimes[0].available = true;
    }
    if (isCommandAvailable('codex')) {
        runtimes[1].available = true;
    }
    if (isCommandAvailable('claude')) {
        runtimes[2].available = true;
    }
    if (isCommandAvailable(goosePath) || isCommandAvailable('goose')) {
        runtimes[3].available = true;
    }
    if (isCommandAvailable('qwen')) {
        runtimes[4].available = true;
    }
    if (isCommandAvailable('antigravity')) {
        runtimes[5].available = true;
    }

    return runtimes;
}

/**
 * Spawn the coding agent process securely.
 */
function startAgentRuntime({ runtime, projectId, prompt, customCommand, provider, apiKey }, onOutput, onClose) {
    const allowedRuntimes = ['opencode', 'codex', 'claude', 'goose', 'qwen', 'antigravity', 'custom'];
    if (!allowedRuntimes.includes(runtime)) {
        throw new Error(`Agent runtime "${runtime}" is not allowed or supported.`);
    }

    if (activeProcess) {
        throw new Error('An active agent runtime is already running. Stop it first.');
    }

    const openCodePath = getOpenCodePath();
    const goosePath = getGoosePath();

    // Determine binary based on selected agent runtime
    let binary = '';
    if (runtime === 'opencode') {
        if (isCommandAvailable(openCodePath)) {
            binary = openCodePath;
        } else if (isCommandAvailable('opencode')) {
            binary = 'opencode';
        } else {
            throw new Error('OpenCode CLI binary not found on the host system.');
        }
    } else if (runtime === 'codex') {
        if (isCommandAvailable('codex')) {
            binary = 'codex';
        } else {
            throw new Error('Codex CLI binary not found on the host system.');
        }
    } else if (runtime === 'claude') {
        if (isCommandAvailable('claude')) {
            binary = 'claude';
        } else {
            throw new Error('Claude Code binary not found on the host system.');
        }
    } else if (runtime === 'goose') {
        if (isCommandAvailable(goosePath)) {
            binary = goosePath;
        } else if (isCommandAvailable('goose')) {
            binary = 'goose';
        } else {
            throw new Error('Goose AI Agent CLI binary not found on the host system.');
        }
    } else if (runtime === 'qwen') {
        if (isCommandAvailable('qwen')) {
            binary = 'qwen';
        } else {
            throw new Error('Qwen Coder CLI binary not found on the host system.');
        }
    } else if (runtime === 'antigravity') {
        if (isCommandAvailable('antigravity')) {
            binary = 'antigravity';
        } else {
            throw new Error('Antigravity CLI binary not found on the host system.');
        }
    } else if (runtime === 'custom') {
        binary = customCommand || 'node';
    }

    // Retrieve dynamic websocket bridge loopback configurations
    const config = getAgentBridgeConfig(projectId);
    if (!config) {
        throw new Error('Desktop agent broker not active. Connect the bridge first.');
    }

    const { wsUrl, token } = config;

    // Environmental variables scrubbing (retaining essential AI API keys for agent execution)
    const scrubbedEnv = {};
    const allowedEnvKeys = [
        'PATH', 'HOME', 'USER', 'SHELL', 'LANG', 'LC_ALL',
        'MISTRAL_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY',
        'OLLAMA_HOST', 'OLLAMA_PORT',
        // Windows system/user profile variables
        'SystemRoot', 'SystemDrive', 'windir', 'COMSPEC', 'PATHEXT',
        'TEMP', 'TMP', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH',
        'APPDATA', 'LOCALAPPDATA', 'USERNAME',
        // macOS temporary directory
        'TMPDIR'
    ];
    for (const key of allowedEnvKeys) {
        if (process.env[key]) {
            scrubbedEnv[key] = process.env[key];
        }
    }

    // Dynamically override API keys based on user inputs in eXeLearning UI Configuration panel
    if (provider && apiKey) {
        if (provider === 'openai') {
            scrubbedEnv['OPENAI_API_KEY'] = apiKey;
        } else if (provider === 'anthropic') {
            scrubbedEnv['ANTHROPIC_API_KEY'] = apiKey;
        } else if (provider === 'gemini') {
            scrubbedEnv['GEMINI_API_KEY'] = apiKey;
        } else if (provider === 'mistral') {
            scrubbedEnv['MISTRAL_API_KEY'] = apiKey;
        } else if (provider === 'ollama') {
            scrubbedEnv['OLLAMA_HOST'] = apiKey || 'http://127.0.0.1:11434';
        }
    }

    scrubbedEnv['EXE_AGENT_WS_URL'] = wsUrl;
    scrubbedEnv['EXE_AGENT_TOKEN'] = token;
    scrubbedEnv['EXE_AGENT_PROJECT_ID'] = projectId;
    scrubbedEnv['EXE_AGENT_PROMPT'] = prompt;
    scrubbedEnv['EXE_AGENT_OPENCODE_BIN'] = binary;
    scrubbedEnv['EXE_AGENT_RUNTIME'] = runtime;
    scrubbedEnv['EXE_AGENT_WORKDIR'] = path.resolve(__dirname, '..');
    scrubbedEnv['ELECTRON_RUN_AS_NODE'] = '1';

    const adapterPath = path.join(__dirname, 'opencode-ws-adapter.js');

    console.log(`[RuntimeManager] Spawning AI Agent adapter [${runtime}] for projectId: ${projectId}`);

    activeProcess = child_process.spawn(process.execPath, [adapterPath], {
        cwd: path.resolve(__dirname, '..'),
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
