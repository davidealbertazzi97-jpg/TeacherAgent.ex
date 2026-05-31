const childProcess = require('child_process');
const WebSocket = require('ws');

const MAX_ITERATIONS = 8;
const OPENCODE_TIMEOUT_MS = 10 * 60 * 1000;

function send(socket, payload) {
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(payload));
    }
}

function callTool(socket, tool, args = {}) {
    return new Promise((resolve) => {
        const id = `tool-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const onMessage = (data) => {
            let message;
            try {
                message = JSON.parse(data.toString());
            } catch (_e) {
                return;
            }
            if (message.type !== 'tool.result' || message.id !== id) return;
            socket.off('message', onMessage);
            resolve(message);
        };
        socket.on('message', onMessage);
        send(socket, { id, type: 'tool.call', tool, args });
    });
}

function extractJson(text) {
    const fenced = text.match(/```json\s*([\s\S]*?)```/i);
    const raw = fenced ? fenced[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    if (!raw || raw.trim() === '') {
        throw new Error('Agent did not return a JSON object');
    }
    return JSON.parse(raw);
}

function runAgent(message) {
    return new Promise((resolve, reject) => {
        const binary = process.env.EXE_AGENT_OPENCODE_BIN || 'opencode';
        const runtimeName = process.env.EXE_AGENT_RUNTIME || 'opencode';
        const capitalizedRuntime = runtimeName.charAt(0).toUpperCase() + runtimeName.slice(1);

        childProcess.execFile(
            binary,
            ['run', message],
            {
                cwd: process.env.EXE_AGENT_WORKDIR || '/home/asus/exelearning-code',
                env: process.env,
                timeout: OPENCODE_TIMEOUT_MS,
                maxBuffer: 20 * 1024 * 1024
            },
            (error, stdout, stderr) => {
                if (stderr) process.stderr.write(stderr);
                if (error) {
                    reject(error);
                    return;
                }
                resolve(stdout);
            }
        );
    });
}

function buildAgentPrompt({ userPrompt, structure, idevices, history }) {
    const runtimeName = process.env.EXE_AGENT_RUNTIME || 'opencode';
    const capitalizedRuntime = runtimeName.charAt(0).toUpperCase() + runtimeName.slice(1);

    return `You are ${capitalizedRuntime}, a powerful AI agent controlling eXeLearning through a WebSocket tool adapter.

As a high-capability agent running on the host system, you have access to external resources. You are expected and encouraged to:
1. Search the internet using your local capabilities/APIs to find accurate, high-quality, up-to-date scientific or educational information.
2. Find public image URLs or assets on the internet (e.g., Unsplash, Wikimedia Commons, open educational resources) to visually illustrate the course content.
3. Embed these images using standard HTML <img> tags with public absolute URLs or Base64 data strings directly in the HTML code of the iDevices.

You do NOT edit files directly. You build and organize the entire eXeLearning course interactively by returning JSON tool calls.

Available tools:
- read_project_structure {}
- read_available_idevices {}
- create_page {"title": string, "parentId": string|null}
- rename_page {"pageId": string, "title": string}
- move_page {"pageId": string, "parentId": string|null, "index": number|null}
- create_block {"pageId": string, "title": string}
- create_html_idevice {"pageId": string, "blockId": string, "title": string, "html": string, "ideviceType": string}
- update_idevice_html {"pageId": string, "blockId": string, "componentId": string, "html": string}
- delete_page {"pageId": string}
- delete_idevice {"componentId": string}
- validate_project {}
- export_project_elpx {}

Return ONLY one JSON object, no prose:
{
  "tool_calls": [
    {"tool": "create_page", "args": {"title": "...", "parentId": null}}
  ],
  "final_report": null
}

When the project is complete, return:
{
  "tool_calls": [],
  "final_report": "FINAL REPORT: ..."
}

User goal:
${userPrompt}

Current project structure:
${JSON.stringify(structure, null, 2)}

Available iDevices:
${JSON.stringify(idevices, null, 2)}

Previous tool results:
${JSON.stringify(history.slice(-20), null, 2)}

Generate rich, modern, and beautiful educational content. For HTML iDevices, produce complete premium interactive HTML/CSS/JS with vibrant design styles and relevant media assets.`;
}

async function main() {
    const wsUrl = process.env.EXE_AGENT_WS_URL;
    const token = process.env.EXE_AGENT_TOKEN;
    const projectId = process.env.EXE_AGENT_PROJECT_ID || 'default-project';
    const userPrompt = process.env.EXE_AGENT_PROMPT || 'Create an eXeLearning project.';
    const runtimeName = process.env.EXE_AGENT_RUNTIME || 'opencode';
    const capitalizedRuntime = runtimeName.charAt(0).toUpperCase() + runtimeName.slice(1);
    const senderName = `${capitalizedRuntime} Adapter`;

    if (!wsUrl || !token) {
        throw new Error('Missing EXE_AGENT_WS_URL or EXE_AGENT_TOKEN');
    }

    const socket = new WebSocket(`${wsUrl}?role=agent&projectId=${encodeURIComponent(projectId)}&token=${encodeURIComponent(token)}`);

    await new Promise((resolve, reject) => {
        socket.once('open', resolve);
        socket.once('error', reject);
    });

    send(socket, {
        type: 'agent.chat',
        sender: senderName,
        role: 'assistant',
        content: `${senderName} connected. Starting autonomous project build.`,
        timestamp: Date.now()
    });

    const history = [];
    let structure = (await callTool(socket, 'read_project_structure')).result;
    const idevices = (await callTool(socket, 'read_available_idevices')).result;

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
        send(socket, {
            type: 'agent.log',
            level: 'info',
            message: `${capitalizedRuntime} planning iteration ${iteration + 1}/${MAX_ITERATIONS}`,
            timestamp: Date.now()
        });

        const prompt = buildAgentPrompt({ userPrompt, structure, idevices, history });
        const output = await runAgent(prompt);
        const decision = extractJson(output);

        if (decision.final_report) {
            send(socket, {
                type: 'agent.chat',
                sender: senderName,
                role: 'assistant',
                content: decision.final_report,
                timestamp: Date.now()
            });
            socket.close();
            return;
        }

        const calls = Array.isArray(decision.tool_calls) ? decision.tool_calls : [];
        if (calls.length === 0) {
            send(socket, {
                type: 'agent.chat',
                sender: senderName,
                role: 'assistant',
                content: `FINAL REPORT: ${capitalizedRuntime} returned no tool calls. No further actions were taken.`,
                timestamp: Date.now()
            });
            socket.close();
            return;
        }

        for (const call of calls) {
            const result = await callTool(socket, call.tool, call.args || {});
            history.push({ call, result });
            send(socket, {
                type: 'agent.log',
                level: result.ok ? 'info' : 'error',
                message: `${call.tool}: ${result.ok ? 'ok' : result.error}`,
                timestamp: Date.now()
            });
        }
        structure = (await callTool(socket, 'read_project_structure')).result;
    }

    const validation = await callTool(socket, 'validate_project');
    send(socket, {
        type: 'agent.chat',
        sender: senderName,
        role: 'assistant',
        content: `FINAL REPORT: Iteration limit reached. Validation: ${JSON.stringify(validation.result || validation.error)}`,
        timestamp: Date.now()
    });
    socket.close();
}

main().catch((error) => {
    const runtimeName = process.env.EXE_AGENT_RUNTIME || 'opencode';
    const capitalizedRuntime = runtimeName.charAt(0).toUpperCase() + runtimeName.slice(1);
    console.error(`[${capitalizedRuntime}Adapter] ${error.stack || error.message}`);
    process.exit(1);
});
