/**
 * FakeAgent
 * Simulated external coding agent.
 * Connects to /agent-bridge as 'role=agent' via a separate WebSocket connection,
 * walks through a JSON-RPC tool.call sequence with timeouts, and posts progress back to the chat.
 */
export class FakeAgent {
  constructor(projectId, token, logCallback, wsUrl = null) {
    this.projectId = projectId || 'default-project';
    this.token = token || '';
    this.log = logCallback || console.log;
    this.wsUrl = wsUrl;
    this.socket = null;
    this.callbacks = new Map();
    this.connected = false;
  }

  /**
   * Start the fake agent connection and trigger the task sequence.
   */
  start() {
    const wsUrl = this.buildWebSocketUrl();

    this.log('[FakeAgent] Booting simulated external agent...');
    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.connected = true;
        this.log('[FakeAgent] Connected to WebSocket tool bridge.');
        this.sendChat('Hello! I am FakeAgent, a simulated external coding agent connected via WebSocket. Preparing to co-author volcanology course...', 'assistant');
        
        // Delay slightly and begin sequential task execution
        this.sequenceTimeout = setTimeout(() => this.runTaskSequence(), 1000);
      };

      this.socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg && msg.type === 'tool.result') {
            const cb = this.callbacks.get(msg.id);
            if (cb) {
              this.callbacks.delete(msg.id);
              cb(msg);
            }
          }
        } catch (e) {
          this.log(`[FakeAgent] Error parsing relay message: ${e.message}`);
        }
      };

      this.socket.onclose = () => {
        this.connected = false;
        this.log('[FakeAgent] Disconnected from tool bridge.');
      };

      this.socket.onerror = (err) => {
        this.log(`[FakeAgent] Connection error: ${err.message || 'unknown'}`);
      };
    } catch (e) {
      this.log(`[FakeAgent] Failed to initiate connection: ${e.message}`);
    }
  }

  /**
   * Stop the Fake Agent and clean up all pending callbacks/timeouts.
   */
  stop() {
    this.log('[FakeAgent] Stop command received. Cleaning up active agent tasks...');
    if (this.sequenceTimeout) {
      clearTimeout(this.sequenceTimeout);
      this.sequenceTimeout = null;
    }
    if (this.socketTimeout) {
      clearTimeout(this.socketTimeout);
      this.socketTimeout = null;
    }

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.connected = false;

    // Resolve or reject all pending callbacks to avoid hangs
    for (const [id, cb] of this.callbacks.entries()) {
      cb({ ok: false, error: 'Agent execution stopped by user.' });
    }
    this.callbacks.clear();
  }

  /**
   * Build the broker URL. Desktop mode passes the dynamic Electron broker URL;
   * web/server mode falls back to the current origin.
   */
  buildWebSocketUrl() {
    const baseUrl = this.wsUrl || (() => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host || 'localhost:3002';
      return `${protocol}//${host}/agent-bridge`;
    })();
    return `${baseUrl}?role=agent&projectId=${this.projectId}&token=${this.token}`;
  }

  /**
   * Helper to execute a JSON-RPC tool.call and wait for response with a 5s timeout.
   */
  callTool(tool, args = {}) {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject(new Error('Agent not connected to bridge'));
        return;
      }

      const id = `call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const payload = {
        id,
        type: 'tool.call',
        tool,
        args
      };

      // 5-second timeout safeguard for every tool call
      const timeoutId = setTimeout(() => {
        if (this.callbacks.has(id)) {
          this.callbacks.delete(id);
          reject(new Error(`Tool "${tool}" call timed out after 5 seconds`));
        }
      }, 5000);

      this.callbacks.set(id, (res) => {
        clearTimeout(timeoutId);
        if (res.ok) {
          resolve(res.result);
        } else {
          reject(new Error(res.error || `Tool ${tool} failed`));
        }
      });

      this.socket.send(JSON.stringify(payload));
    });
  }

  /**
   * Post a simulated chat message to the room.
   */
  sendChat(content, role = 'assistant') {
    if (this.socket && this.connected) {
      this.socket.send(JSON.stringify({
        type: 'agent.chat',
        sender: 'Simulated Agent',
        role,
        content,
        timestamp: Date.now()
      }));
    }
  }

  /**
   * Post a log back to eXeLearning sidebar logger.
   */
  sendLog(message, level = 'info') {
    if (this.socket && this.connected) {
      this.socket.send(JSON.stringify({
        type: 'agent.log',
        level,
        message,
        timestamp: Date.now()
      }));
    }
  }

  /**
   * Sequential co-authoring logic.
   */
  async runTaskSequence() {
    try {
      this.sendLog('Step 1/5: Reading active project structure...');
      const structure = await this.callTool('read_project_structure');
      this.sendLog(`Current page count: ${structure.length}`);

      this.sendLog('Step 2/5: Creating new volcano chapter page...', 'tool');
      const pageRes = await this.callTool('create_page', {
        title: 'Geografia: I Vulcani',
        parentId: null
      });
      const pageId = pageRes.pageId;
      this.sendLog(`Page created with actual Yjs ID: ${pageId}`, 'success');

      this.sendLog('Step 3/5: Creating new lesson block inside the page...', 'tool');
      const blockRes = await this.callTool('create_block', {
        pageId,
        title: 'Introduzione ai Vulcani'
      });
      const blockId = blockRes.blockId;
      this.sendLog(`Block created with actual Yjs ID: ${blockId}`, 'success');

      this.sendLog('Step 4/5: Instantiating rich HTML text iDevice in the block...', 'tool');
      const compRes = await this.callTool('create_html_idevice', {
        pageId,
        blockId,
        title: 'Spiegazione e Struttura',
        html: `
          <div style="padding: 15px; border-radius: 8px; border-left: 5px solid #ff4400; background: rgba(255,68,0,0.04);">
            <h2>🌋 Teoria Vulcanica</h2>
            <p>I vulcani sono fratture naturali della crosta terrestre da cui fuoriescono materiali incandescenti.</p>
            <ul>
              <li><strong>Condotto principale:</strong> Canale di risalita del magma.</li>
              <li><strong>Lava:</strong> Magma privato dei gas in superficie.</li>
            </ul>
          </div>
        `
      });
      this.sendLog(`iDevice HTML written with actual Yjs ID: ${compRes.componentId}`, 'success');

      this.sendLog('Step 5/5: Validating project integrity...', 'tool');
      const valRes = await this.callTool('validate_project');
      this.sendLog(`Validation status: ${valRes.isValid ? 'VALID' : 'WARNINGS'}`, valRes.isValid ? 'success' : 'warn');

      // Final report completion
      this.sendChat('FINAL REPORT: Volcanology course layout successfully initialized using clean Yjs transactional tools over WebSocket.', 'assistant');
      this.log('[FakeAgent] Sequence finished successfully!');
      
      // Gracefully disconnect
      this.socketTimeout = setTimeout(() => {
        if (this.socket) this.socket.close();
      }, 3000);
    } catch (e) {
      this.sendLog(`Task aborted due to tool failure: ${e.message}`, 'error');
      this.sendChat(`Crashed: ${e.message}`, 'error');
      if (this.socket) this.socket.close();
    }
  }
}
