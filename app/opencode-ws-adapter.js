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
    // 1. Try to extract JSON from markdown fences first
    const fenced = text.match(/```json\s*([\s\S]*?)```/i);
    if (fenced && fenced[1].trim()) {
        try {
            return JSON.parse(fenced[1].trim());
        } catch (_) {}
    }

    // 2. Look for the outermost matching curly braces {} in the text
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
        const candidate = text.slice(start, end + 1);
        try {
            return JSON.parse(candidate);
        } catch (_) {
            // Try matching nested brace pairs sequentially
            let bracketCount = 0;
            let firstBrace = -1;
            for (let i = 0; i < text.length; i++) {
                if (text[i] === '{') {
                    if (bracketCount === 0) firstBrace = i;
                    bracketCount++;
                } else if (text[i] === '}') {
                    bracketCount--;
                    if (bracketCount === 0 && firstBrace !== -1) {
                        try {
                            const subCandidate = text.slice(firstBrace, i + 1);
                            return JSON.parse(subCandidate);
                        } catch (_) {}
                    }
                }
            }
        }
    }

    throw new Error('Agent did not return a valid JSON object');
}

function runAgent(message) {
    return new Promise((resolve, reject) => {
        const binary = process.env.EXE_AGENT_OPENCODE_BIN || 'opencode';
        const runtimeName = process.env.EXE_AGENT_RUNTIME || 'opencode';
        const capitalizedRuntime = runtimeName.charAt(0).toUpperCase() + runtimeName.slice(1);

        let args = ['run', message];

        childProcess.execFile(
            binary,
            args,
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

function buildAgentPrompt({ userPrompt, structure, idevices, history, chatHistory }) {
    const runtimeName = process.env.EXE_AGENT_RUNTIME || 'opencode';
    const capitalizedRuntime = runtimeName.charAt(0).toUpperCase() + runtimeName.slice(1);

    const formattedDialogue = chatHistory && chatHistory.length > 0
        ? `\nActive dialogue with the Teacher (newest instructions override previous goals):\n${chatHistory.map(c => `[Teacher]: ${c.content}`).join('\n')}\n`
        : '';

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
- update_idevice_properties {"componentId": string, "properties": object}
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
${formattedDialogue}
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
    const userPrompt = process.env.EXE_AGENT_PROMPT || '';
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

    const chatHistory = [];

    // Global real-time chat dialogue listener to intercept teacher responses
    socket.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            if (message && message.type === 'agent.chat' && message.role === 'user') {
                console.log(`[WSAdapter] Captured teacher chat input: "${message.content}"`);
                chatHistory.push({
                    role: 'user',
                    content: message.content,
                    timestamp: message.timestamp || Date.now()
                });
            }
        } catch (_) {}
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

    // Wait until there is a user prompt (from Electron payload) OR a chat message arrives from the teacher
    if (!userPrompt && chatHistory.length === 0) {
        send(socket, {
            type: 'agent.log',
            level: 'info',
            message: 'Waiting for your instructions in the chat to begin...',
            timestamp: Date.now()
        });
        while (!userPrompt && chatHistory.length === 0) {
            await new Promise(res => setTimeout(res, 1000));
        }
    }

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
        // Sleep briefly to yield execution and let teacher type inputs in real-time
        await new Promise(res => setTimeout(res, 2000));

        send(socket, {
            type: 'agent.log',
            level: 'info',
            message: `${capitalizedRuntime} planning iteration ${iteration + 1}/${MAX_ITERATIONS}`,
            timestamp: Date.now()
        });

        const prompt = buildAgentPrompt({ userPrompt, structure, idevices, history, chatHistory });
        const output = await runAgent(prompt);
        console.log(`[WSAdapter] Raw Agent Output:\n${output}\n`);
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
