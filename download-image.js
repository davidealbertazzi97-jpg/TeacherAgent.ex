#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'app/bridge-config.json'), 'utf8'));
const imageUrl = process.argv[2] || 'https://commons.wikimedia.org/wiki/File:Talpa_europaea_MHNT_on_white_background.jpg';

const wsUrl = `${config.wsUrl}?role=agent&projectId=${encodeURIComponent(config.projectId)}&token=${encodeURIComponent(config.token)}`;
console.log('Connecting to:', wsUrl.replace(config.token, '***'));

const ws = new WebSocket(wsUrl);

ws.on('open', () => {
    console.log('Connected!');
    const msg = {
        type: 'agent_tool_call',
        tool: 'download_remote_image',
        args: { url: imageUrl },
        callId: 'cli-download-' + Date.now()
    };
    ws.send(JSON.stringify(msg));
});

ws.on('message', (data) => {
    const result = JSON.parse(data.toString());
    if (result.type === 'tool_result') {
        console.log('Tool result ok:', result.ok);
        if (result.result && result.result.assetUrl) {
            console.log('Asset URL:', result.result.assetUrl);
        }
        if (result.error) {
            console.log('Error:', result.error);
        }
        ws.close();
    } else {
        console.log('Message type:', result.type);
    }
});

ws.on('error', (err) => {
    console.error('WebSocket error:', err.message);
    process.exit(1);
});

ws.on('close', () => {
    process.exit(0);
});
