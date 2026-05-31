#!/usr/bin/env node

/**
 * eXeLearning CLI - External Agent WebSocket Controller
 * Allows any external agent or command-line process to discover the active eXeLearning session
 * and call Yjs tools directly.
 * 
 * Usage:
 *   node scripts/exelearning-cli.js <tool_name> [json_arguments]
 * 
 * Examples:
 *   node scripts/exelearning-cli.js read_project_structure
 *   node scripts/exelearning-cli.js create_page '{"title": "Nuova Pagina", "parentId": null}'
 */

const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

// Supported Yjs Tools list for help menu and validation
const SUPPORTED_TOOLS = {
    'read_project_structure': {
        desc: 'Read the complete hierarchical page structure of the project',
        args: '{}'
    },
    'read_available_idevices': {
        desc: 'List all available iDevice models registered in eXeLearning',
        args: '{}'
    },
    'create_page': {
        desc: 'Create a new page in the course structure',
        args: '{"title": "Page Title", "parentId": "parent-page-id-or-null"}'
    },
    'rename_page': {
        desc: 'Rename an existing page',
        args: '{"pageId": "page-uuid", "title": "New Title"}'
    },
    'move_page': {
        desc: 'Re-order or nest a page under a new parent',
        args: '{"pageId": "page-uuid", "parentId": "parent-uuid-or-null", "index": number-or-null}'
    },
    'create_block': {
        desc: 'Create a content container block inside a page',
        args: '{"pageId": "page-uuid", "title": "Block Title"}'
    },
    'create_html_idevice': {
        desc: 'Insert a premium HTML-capable interactive module in a block',
        args: '{"pageId": "page-uuid", "blockId": "block-uuid", "title": "iDevice Title", "html": "HTML content", "ideviceType": "FreeTextIdevice"}'
    },
    'update_idevice_html': {
        desc: 'Update the HTML markup inside a premium content module component',
        args: '{"pageId": "page-uuid", "blockId": "block-uuid", "componentId": "comp-uuid", "html": "New HTML Content"}'
    },
    'update_idevice_properties': {
        desc: 'Update generic component configuration parameters',
        args: '{"componentId": "comp-uuid", "properties": {"prop": "val"}}'
    },
    'delete_page': {
        desc: 'Permanently remove a page and all its blocks/idevices',
        args: '{"pageId": "page-uuid"}'
    },
    'delete_idevice': {
        desc: 'Remove an iDevice component from a block',
        args: '{"componentId": "component-uuid"}'
    },
    'validate_project': {
        desc: 'Run logical checks on the course Yjs model structures',
        args: '{}'
    },
    'export_project_elpx': {
        desc: 'Compile and export the current course as an ELPX archive package',
        args: '{}'
    }
};

function printHelp() {
    console.log(`
eXeLearning Agent CLI - Command Line Tool Controller
====================================================
Allows external runtimes to control the active eXeLearning instance.

Usage:
  node scripts/exelearning-cli.js <tool_name> [json_arguments]

Available Tools:`);
    for (const [name, meta] of Object.entries(SUPPORTED_TOOLS)) {
        console.log(`  - ${name.padEnd(28)} : ${meta.desc}`);
        console.log(`    Expected args: ${meta.args}`);
    }
    console.log(`
Example:
  node scripts/exelearning-cli.js create_page '{"title": "Il Sistema Solare"}'
`);
}

async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
        printHelp();
        process.exit(0);
    }

    const toolName = args[0];
    if (!SUPPORTED_TOOLS[toolName]) {
        console.error(`Error: Unsupported tool "${toolName}". Run with --help to see all available tools.`);
        process.exit(1);
    }

    let toolArgs = {};
    if (args[1]) {
        try {
            toolArgs = JSON.parse(args[1]);
        } catch (e) {
            console.error(`Error: Invalid JSON arguments passed for tool "${toolName}".`);
            console.error(`Received: ${args[1]}`);
            console.error(`Reason: ${e.message}`);
            process.exit(1);
        }
    }

    // 1. Auto-discover active session configurations
    const configPath = path.join(__dirname, '../app/bridge-config.json');
    if (!fs.existsSync(configPath)) {
        console.error('Error: Discovery file "app/bridge-config.json" not found.');
        console.error('Make sure eXeLearning is actively running with the AI sidebar loaded.');
        process.exit(1);
    }

    let config;
    try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (e) {
        console.error(`Error: Failed to parse discovery file: ${e.message}`);
        process.exit(1);
    }

    const { wsUrl, token } = config;
    const projectId = config.activeProjects && config.activeProjects.length > 0 
        ? config.activeProjects[0] 
        : (config.projectId || 'default-project');

    if (!wsUrl || !token) {
        console.error('Error: Incomplete session configuration in app/bridge-config.json');
        process.exit(1);
    }

    // 2. Connect to the WebSocket broker
    const fullWsUrl = `${wsUrl}?role=agent&projectId=${encodeURIComponent(projectId)}&token=${encodeURIComponent(token)}`;
    const socket = new WebSocket(fullWsUrl);

    await new Promise((resolve, reject) => {
        socket.once('open', resolve);
        socket.once('error', (err) => {
            reject(new Error(`WebSocket connection failed: ${err.message}`));
        });
    });

    // 3. Call the tool and wait for the response
    const callId = `cli-tool-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    
    const callPromise = new Promise((resolve, reject) => {
        const onMessage = (data) => {
            let msg;
            try {
                msg = JSON.parse(data.toString());
            } catch (_) {
                return;
            }
            if (msg.type === 'tool.result' && msg.id === callId) {
                socket.off('message', onMessage);
                resolve(msg);
            }
        };

        socket.on('message', onMessage);

        const payload = {
            id: callId,
            type: 'tool.call',
            tool: toolName,
            args: toolArgs
        };
        
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(payload));
        } else {
            reject(new Error('WebSocket closed unexpectedly before sending payload.'));
        }
    });

    try {
        const result = await callPromise;
        // Print clean stringified JSON result to stdout for command-line parsing
        console.log(JSON.stringify(result, null, 2));
        socket.close();
        if (!result.ok) {
            process.exit(1);
        }
    } catch (err) {
        console.error(`Error: Tool call failed: ${err.message}`);
        socket.close();
        process.exit(1);
    }
}

main().catch(err => {
    console.error(`Fatal CLI error: ${err.message}`);
    process.exit(1);
});
