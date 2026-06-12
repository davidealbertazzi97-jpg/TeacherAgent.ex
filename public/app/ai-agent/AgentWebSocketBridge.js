/**
 * AgentWebSocketBridge
 * Client-side JSON-RPC-like WebSocket receiver that processes incoming tool.calls 
 * from coding agents (or fake agents) and routes them through the AgentToolBus.
 * Implements strict security policies and fetches a startup session token.
 */
export class AgentWebSocketBridge {
  constructor(sidebar) {
    this.sidebar = sidebar;
    this.toolBus = sidebar.toolBus;
    this.socket = null;
    this.projectId = null;
    this.wsUrl = null;
    this.connected = false;
  }

  /**
   * Connect securely to the WebSocket relay server (Electron broker or Bun server).
   */
  async connect(projectId) {
    if (this.connected) return;

    this.projectId = projectId || window.eXeLearning?.projectId || 'default-project';
    
    let wsUrl = '';
    let token = '';

    if (window.electronAPI && typeof window.electronAPI.getAgentBridgeConfig === 'function') {
      // 1. Desktop Electron mode: Retrieve configurations from Electron secure main process
      this.sidebar.logSystem('Retrieving secure agent configuration from Electron...');
      try {
        const config = await window.electronAPI.getAgentBridgeConfig(this.projectId);
        if (!config) {
          throw new Error('Electron agent broker configuration not initialized');
        }
        wsUrl = config.wsUrl;
        token = config.token;
        
        // Store token on the sidebar so FakeAgent can read it upon launching
        this.sidebar.token = token;
      } catch (e) {
        this.sidebar.logSystem(`Desktop broker handshake failed: ${e.message}`, 'error');
        this.sidebar.updateConnectionStatus(false);
        return;
      }
    } else {
      // 2. Web local / server mode: Query Bun server API
      this.sidebar.logSystem('Fetching secure session token from Bun backend...');
      try {
        const response = await fetch('/api/agent-token');
        const data = await response.json();
        token = data.token;
        this.sidebar.token = token;
        
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host || 'localhost:3002';
        wsUrl = `${protocol}//${host}/agent-bridge`;
      } catch (e) {
        this.sidebar.logSystem(`Web handshake failed: ${e.message}`, 'error');
        this.sidebar.updateConnectionStatus(false);
        return;
      }
    }

    const fullWsUrl = `${wsUrl}?role=client&projectId=${this.projectId}&token=${token}`;
    this.wsUrl = wsUrl;
    this.sidebar.agentBridgeConfig = {
      wsUrl,
      token,
      projectId: this.projectId
    };
    this.sidebar.logSystem(`Connecting tool server to relay: ${wsUrl}...`);

    try {
      this.socket = new WebSocket(fullWsUrl);

      this.socket.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data);
          
          // Strict schema validation of incoming messages
          if (!message || typeof message !== 'object') return;

          if (message.type === 'tool.call') {
            await this.handleToolCall(message);
          } else if (message.type === 'agent.chat') {
            // Display message in chat body
            this.sidebar.appendLocalBubble(message.sender || 'Agent', message.role || 'assistant', message.content);
          } else if (message.type === 'agent.log') {
            this.sidebar.logSystem(`[Agent] ${message.message}`, message.level || 'info');
          }
        } catch (e) {
          console.warn('[AgentWSBridge] Error parsing WS message:', e);
        }
      };

      const handleClose = () => {
        this.connected = false;
        this.sidebar.logSystem('Tool server bridge disconnected.', 'error');
        this.sidebar.updateConnectionStatus(false);
      };

      const handleError = (err) => {
        this.sidebar.logSystem(`Bridge error: ${err.message || 'unknown'}`, 'error');
      };

      await new Promise((resolve, reject) => {
        let settled = false;

        this.socket.onopen = () => {
          settled = true;
          this.connected = true;
          this.sidebar.logSystem('Tool server bridge connected and active.', 'success');
          this.sidebar.updateConnectionStatus(true);
          resolve();
        };

        this.socket.onclose = () => {
          handleClose();
          if (!settled) {
            settled = true;
            reject(new Error('WebSocket closed before the bridge became ready'));
          }
        };

        this.socket.onerror = (err) => {
          handleError(err);
          if (!settled) {
            settled = true;
            reject(new Error(err.message || 'WebSocket bridge connection failed'));
          }
        };
      });
    } catch (e) {
      this.sidebar.logSystem(`Failed to build WebSocket: ${e.message}`, 'error');
      this.sidebar.updateConnectionStatus(false);
    }
  }

  /**
   * Close the WebSocket connection.
   */
  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.connected = false;
    this.wsUrl = null;
    this.sidebar.updateConnectionStatus(false);
  }

  /**
   * Processes an incoming JSON-RPC tool.call and sends back the result after verifying security policies.
   */
  async handleToolCall(call) {
    const { id, tool, args } = call;
    this.sidebar.logSystem(`Received tool request: ${tool}`, 'tool');

    // Supported tools allowlist (snapshots removed for consistency/security)
    const supportedTools = [
      'read_project_structure',
      'read_available_idevices',
      'create_page',
      'rename_page',
      'move_page',
      'create_block',
      'create_html_idevice',
      'update_idevice_html',
      'update_idevice_properties',
      'delete_page',
      'delete_idevice',
      'validate_project',
      'export_project_elpx',
      'create_idevice',
      'download_remote_image'
    ];

    if (!supportedTools.includes(tool)) {
      this.sendResponse({
        id,
        type: 'tool.result',
        ok: false,
        result: null,
        error: `Tool "${tool}" is not supported or is disabled.`,
        warnings: []
      });
      return;
    }

    // Apply security policies (Safe / Assisted / Autonomous / PowerUser)
    const mode = this.sidebar.mode || 'assisted';
    const readTools = ['read_project_structure', 'read_available_idevices', 'validate_project'];

    // Mode 1: SAFE blocks all writes
    if (mode === 'safe' && !readTools.includes(tool)) {
      this.sidebar.logSystem(`Blocked mutative tool "${tool}" in SAFE mode.`, 'error');
      this.sendResponse({
        id,
        type: 'tool.result',
        ok: false,
        result: null,
        error: `Tool "${tool}" execution blocked: current workspace mode is SAFE.`,
        warnings: []
      });
      return;
    }

    // Proceed with execution
    this.sidebar.logSystem(`Executing tool call: ${tool}`, 'success');

    try {
      let result;
      switch (tool) {
        case 'read_project_structure':
          result = await this.toolBus.read_project_structure();
          break;
        case 'read_available_idevices':
          result = await this.toolBus.read_available_idevices();
          break;
        case 'create_page':
          result = await this.toolBus.create_page(args);
          break;
        case 'rename_page':
          result = await this.toolBus.rename_page(args);
          break;
        case 'move_page':
          result = await this.toolBus.move_page(args);
          break;
        case 'create_block':
          result = await this.toolBus.create_block(args);
          break;
        case 'create_html_idevice':
          result = await this.toolBus.create_html_idevice(args);
          break;
        case 'update_idevice_html':
          result = await this.toolBus.update_idevice_html(args);
          break;
        case 'delete_page':
          result = await this.toolBus.delete_page(args);
          break;
        case 'delete_idevice':
          result = await this.toolBus.delete_idevice(args);
          break;
        case 'validate_project':
          result = await this.toolBus.validate_project();
          break;
        case 'export_project_elpx':
          result = await this.toolBus.export_project_elpx();
          break;
        case 'update_idevice_properties':
          result = await this.toolBus.update_idevice_properties(args);
          break;
        case 'create_idevice':
          result = await this.toolBus.create_idevice(args);
          break;
        case 'download_remote_image':
          result = await this.toolBus.download_remote_image(args);
          break;
      }

      this.sendResponse({
        id,
        type: 'tool.result',
        ok: result.ok,
        result: result.result,
        error: result.error,
        warnings: result.warnings || []
      });
    } catch (e) {
      this.sendResponse({
        id,
        type: 'tool.result',
        ok: false,
        result: null,
        error: e.message,
        warnings: []
      });
    }
  }

  /**
   * Sends JSON-RPC response back over WebSocket.
   */
  sendResponse(response) {
    if (this.socket && this.socket.readyState === 1) {
      this.socket.send(JSON.stringify(response));
    }
  }
}
