import { AgentToolBus } from './AgentToolBus.js';
import { IdeviceRegistry } from './IdeviceRegistry.js';
import { AgentWebSocketBridge } from './AgentWebSocketBridge.js';
import { FakeAgent } from './FakeAgent.js';

export class AgentSidebar {
  constructor(app) {
    this.app = app;
    this.projectManager = app.project;
    this.toolBus = new AgentToolBus(this.projectManager);
    this.registry = new IdeviceRegistry(this.toolBus);

    // Core WS Bridges
    this.wsBridge = new AgentWebSocketBridge(this);
    this.activeFakeAgent = null;
    this.token = '';

    this.active = false;
    this.mode = 'power-user'; // 'safe', 'assisted', 'autonomous', 'power-user'
    this.selectedAgent = 'fake'; // 'opencode', 'codex', 'claude', 'qwen', 'antigravity', 'custom', 'fake'

    this.container = null;
    this.toggleBtn = null;
    this.chatBody = null;
    this.textarea = null;
    this.logBody = null;
    this.connectionIndicator = null;
    this.startFakeBtn = null;
    this.agentSelector = null;
    this.modeSelector = null;
  }

  /**
   * Initialise the sidebar UI components and styles.
   */
  init() {
    this.injectStyles();
    this.createToggleButton();
    this.createSidebarMarkup();
    this.bindDOMEvents();
    this.registerDesktopEventListeners();

    this.logSystem('AI Control Center Sidebar loaded.', 'success');
  }

  /**
   * Inject the CSS stylesheet utilizing composeUrl when available.
   */
  injectStyles() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    let path = '/app/ai-agent/AgentSidebar.css';
    if (this.app && typeof this.app.composeUrl === 'function') {
      path = this.app.composeUrl(path);
    } else if (window.eXeLearning?.app && typeof window.eXeLearning.app.composeUrl === 'function') {
      path = window.eXeLearning.app.composeUrl(path);
    }
    link.href = path;
    document.head.appendChild(link);
  }

  /**
   * Create the floating toggle button.
   */
  createToggleButton() {
    const btn = document.createElement('button');
    btn.className = 'agent-sidebar-toggle-btn';
    btn.setAttribute('title', 'AI Power Agent Control Panel');
    btn.innerHTML = '<icon>psychology</icon>';
    document.body.appendChild(btn);
    this.toggleBtn = btn;
  }

  /**
   * Create the sidebar panel HTML markup.
   */
  createSidebarMarkup() {
    const sidebar = document.createElement('div');
    sidebar.className = 'agent-sidebar-container';
    sidebar.innerHTML = `
      <div class="agent-sidebar-header">
        <div class="agent-sidebar-title-wrapper">
          <icon class="agent-header-icon">psychology</icon>
          <div>
            <div class="agent-sidebar-title">AI Control Center</div>
            <div class="agent-conn-status" id="agentConnStatus">
              <span class="status-dot disconnected"></span> Offline
            </div>
          </div>
        </div>
        <button class="agent-sidebar-close-btn" title="Close Panel">&times;</button>
      </div>

      <!-- Agent Profile & Connection Panel -->
      <div class="agent-settings-panel">
        <div class="agent-dropdown-row">
          <select class="agent-dropdown">
            <option value="fake">Fake Agent (Simulation)</option>
            <option value="opencode">OpenCode CLI</option>
            <option value="codex">Codex CLI</option>
            <option value="claude">Claude Code</option>
            <option value="qwen">Qwen Coder CLI</option>
            <option value="antigravity">Antigravity CLI</option>
            <option value="custom">Custom Command</option>
          </select>
          <button class="agent-connect-btn">Connect</button>
        </div>

        <div class="agent-actions-row">
          <button class="agent-action-btn" id="startFakeBtn">
            <icon>play_arrow</icon> Start Fake Job
          </button>
          <button class="agent-action-btn" id="stopAgentBtn">
            <icon>stop</icon> Stop
          </button>
        </div>

        <!-- Collapsible Credentials & Settings Subpanel -->
        <div class="agent-credentials-wrapper">
          <details class="agent-credentials-details">
            <summary>🔑 AI Credentials & Model Settings</summary>
            <div class="agent-credentials-subpanel">
              <div class="agent-input-field">
                <label>Provider:</label>
                <select class="agent-provider-select">
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="gemini">Gemini</option>
                  <option value="mistral">Mistral</option>
                  <option value="ollama">Ollama (Local)</option>
                </select>
              </div>
              <div class="agent-input-field">
                <label class="agent-key-label">API Key:</label>
                <input type="password" class="agent-key-input" placeholder="Enter API Key..." />
              </div>
            </div>
          </details>
        </div>
      </div>

      <!-- Mode Selector -->
      <div class="agent-sidebar-mode-selector">
        <button class="agent-mode-btn" data-mode="safe">Safe</button>
        <button class="agent-mode-btn" data-mode="assisted">Assisted</button>
        <button class="agent-mode-btn" data-mode="autonomous">Auto</button>
        <button class="agent-mode-btn active" data-mode="power-user">PowerUser</button>
      </div>

      <!-- Chat panel -->
      <div class="agent-sidebar-chat" id="agentChatBody">
        <div class="agent-message assistant">
          Welcome to the eXeLearning AI Control Center. Click <strong>Connect</strong> to link an agent, then send your instructions directly from this chat panel!
        </div>
      </div>

      <!-- Log console & input -->
      <div class="agent-sidebar-input-form">
        <div class="agent-log-container" id="agentLogBody">
          <div class="agent-log-line success">System: Ready.</div>
        </div>
        <div class="agent-input-container">
          <textarea class="agent-textarea" placeholder="Type a message to the AI agent..."></textarea>
          <button class="agent-send-btn" id="agentSendBtn" title="Send Message">
            <icon>send</icon>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(sidebar);
    this.container = sidebar;
    this.chatBody = sidebar.querySelector('#agentChatBody');
    this.textarea = sidebar.querySelector('.agent-textarea');
    this.logBody = sidebar.querySelector('#agentLogBody');
    this.connectionIndicator = sidebar.querySelector('#agentConnStatus');
    this.agentSelector = sidebar.querySelector('.agent-dropdown');
    this.startFakeBtn = sidebar.querySelector('#startFakeBtn');
  }

  /**
   * Register Electron main process stdout/stderr stream listeners if available.
   */
  registerDesktopEventListeners() {
    if (window.electronAPI && typeof window.electronAPI.onAgentRuntimeOutput === 'function') {
      window.electronAPI.onAgentRuntimeOutput(({ data, type }) => {
        const cleanMsg = data.trim();
        if (cleanMsg) {
          const logClass = type === 'stderr' ? 'error' : 'tool';
          this.logSystem(`[CLI ${type}] ${cleanMsg}`, logClass);
        }
      });
    }

    if (window.electronAPI && typeof window.electronAPI.onAgentRuntimeClosed === 'function') {
      window.electronAPI.onAgentRuntimeClosed(({ code, error }) => {
        if (error) {
          this.logSystem(`Agent CLI crashed: ${error}`, 'error');
        } else {
          this.logSystem(`Agent CLI closed with exit code: ${code}`, 'warn');
        }
        this.wsBridge.disconnect();
        const connBtn = this.container.querySelector('.agent-connect-btn');
        if (connBtn) connBtn.innerText = 'Connect';
      });
    }
  }

  /**
   * Bind DOM interactivity.
   */
  bindDOMEvents() {
    // Credentials UI Setup
    const providerSelect = this.container.querySelector('.agent-provider-select');
    const keyInput = this.container.querySelector('.agent-key-input');
    const keyLabel = this.container.querySelector('.agent-key-label');

    const savedProvider = localStorage.getItem('exe_agent_provider') || 'openai';
    providerSelect.value = savedProvider;

    const updateKeyInputPlaceholder = (provider) => {
      if (provider === 'ollama') {
        keyLabel.innerText = 'Ollama Host:';
        keyInput.setAttribute('placeholder', 'e.g., http://127.0.0.1:11434');
      } else {
        keyLabel.innerText = 'API Key:';
        keyInput.setAttribute('placeholder', 'Enter API Key...');
      }
      const savedKey = localStorage.getItem('exe_agent_key_' + provider) || '';
      keyInput.value = savedKey;
    };

    updateKeyInputPlaceholder(savedProvider);

    providerSelect.addEventListener('change', (e) => {
      const prov = e.target.value;
      localStorage.setItem('exe_agent_provider', prov);
      updateKeyInputPlaceholder(prov);
      this.logSystem(`Provider switched to: ${prov}`);
    });

    keyInput.addEventListener('input', (e) => {
      const prov = providerSelect.value;
      localStorage.setItem('exe_agent_key_' + prov, e.target.value.trim());
    });

    // Open/Close toggle
    this.toggleBtn.addEventListener('click', () => this.toggle());
    this.container.querySelector('.agent-sidebar-close-btn').addEventListener('click', () => this.hide());

    // Agent dropdown select
    this.agentSelector.addEventListener('change', (e) => {
      this.selectedAgent = e.target.value;
      this.logSystem(`Selected agent: ${this.selectedAgent}`);

      // Toggle Fake button visibility
      if (this.selectedAgent === 'fake') {
        this.startFakeBtn.style.display = 'flex';
      } else {
        this.startFakeBtn.style.display = 'none';
        this.logSystem(`${this.selectedAgent.charAt(0).toUpperCase() + this.selectedAgent.slice(1)} selected. Click Connect to link.`, 'info');
      }
    });

    // Connection button
    const connBtn = this.container.querySelector('.agent-connect-btn');
    connBtn.addEventListener('click', async () => {
      if (this.wsBridge.connected) {
        if (this.activeFakeAgent) {
          this.activeFakeAgent.stop();
          this.activeFakeAgent = null;
        }
        // Also stop real process runtime if running
        if (window.electronAPI && typeof window.electronAPI.stopAgentRuntime === 'function') {
          await window.electronAPI.stopAgentRuntime();
        }
        this.wsBridge.disconnect();
        connBtn.innerText = 'Connect';
      } else {
        const pId = window.eXeLearning?.projectId || 'default-project';
        await this.wsBridge.connect(pId);
        if (this.wsBridge.connected) {
          connBtn.innerText = 'Disconnect';

          // Spawn real AI Agent runtime in desktop Electron mode
          const realAgents = ['opencode', 'codex', 'claude', 'qwen', 'antigravity', 'custom'];
          if (realAgents.includes(this.selectedAgent)) {
            if (window.electronAPI && typeof window.electronAPI.startAgentRuntime === 'function') {
              const promptGoal = this.textarea.value.trim();
              if (promptGoal) {
                this.textarea.value = '';
                this.appendLocalBubble('Teacher', 'user', promptGoal);
              }
              this.logSystem(`Launching real ${this.selectedAgent} Agent process...`);

              const payload = {
                runtime: this.selectedAgent,
                projectId: pId,
                prompt: promptGoal,
                provider: providerSelect.value,
                apiKey: keyInput.value.trim()
              };
              if (this.selectedAgent === 'custom') {
                payload.customCommand = prompt('Insert custom agent command:', 'node');
              }

              const res = await window.electronAPI.startAgentRuntime(payload);
              if (res && res.error) {
                this.logSystem(`Failed to launch ${this.selectedAgent}: ${res.error}`, 'error');
                this.wsBridge.disconnect();
                connBtn.innerText = 'Connect';
              } else {
                this.logSystem(`${this.selectedAgent} Agent spawned securely from main process.`, 'success');
              }
            } else {
              this.logSystem(`Real agent execution is only supported in Desktop Electron mode.`, 'error');
              this.wsBridge.disconnect();
              connBtn.innerText = 'Connect';
            }
          }
        }
      }
    });

    // Start Fake Job
    this.startFakeBtn.addEventListener('click', () => {
      if (!this.wsBridge.connected) {
        this.logSystem('Please connect the tool bridge before starting a job.', 'error');
        return;
      }
      if (this.activeFakeAgent) {
        this.logSystem('A simulated agent is already active. Stop it first.', 'warn');
        return;
      }
      this.logSystem('Starting simulated Fake Agent...');
      const pId = window.eXeLearning?.projectId || 'default-project';

      // Spawns a separate WebSocket connection representing the external agent passing the session token
      const fakeBrokerUrl = this.agentBridgeConfig?.wsUrl || this.wsBridge.wsUrl;
      this.activeFakeAgent = new FakeAgent(pId, this.token, (logMsg) => {
        this.logSystem(logMsg, 'info');
      }, fakeBrokerUrl);
      this.activeFakeAgent.start();
    });

    // Stop button
    this.container.querySelector('#stopAgentBtn').addEventListener('click', async () => {
      this.logSystem('Stop command issued. Disconnecting active broker connection.', 'warn');
      if (this.activeFakeAgent) {
        this.activeFakeAgent.stop();
        this.activeFakeAgent = null;
      }
      if (window.electronAPI && typeof window.electronAPI.stopAgentRuntime === 'function') {
        await window.electronAPI.stopAgentRuntime();
      }
      this.wsBridge.disconnect();
      connBtn.innerText = 'Connect';
    });

    // Mode switching
    const modeBtns = this.container.querySelectorAll('.agent-mode-btn');
    modeBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        modeBtns.forEach(b => b.classList.remove('active'));
        const targetBtn = e.currentTarget;
        targetBtn.classList.add('active');
        this.mode = targetBtn.dataset.mode;
        this.logSystem(`Workspace permissions set to: ${this.mode.toUpperCase()}`);
      });
    });

    // Chat send button
    this.container.querySelector('#agentSendBtn').addEventListener('click', () => this.handleSendMessage());

    // Send on Enter (without Shift)
    this.textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSendMessage();
      }
    });
  }

  /**
   * Toggles the sidebar visibility.
   */
  toggle() {
    if (this.active) this.hide();
    else this.show();
  }

  /**
   * Show sidebar.
   */
  show() {
    this.active = true;
    this.container.classList.add('active');
  }

  /**
   * Hide sidebar.
   */
  hide() {
    this.active = false;
    this.container.classList.remove('active');
  }

  /**
   * Updates the visual connection dot in the header.
   */
  updateConnectionStatus(isConnected) {
    if (isConnected) {
      this.connectionIndicator.innerHTML = '<span class="status-dot connected"></span> Active Relay';
      this.connectionIndicator.className = 'agent-conn-status active';
    } else {
      this.connectionIndicator.innerHTML = '<span class="status-dot disconnected"></span> Offline';
      this.connectionIndicator.className = 'agent-conn-status';
    }
  }

  /**
   * Chat message submit
   */
  async handleSendMessage() {
    const text = this.textarea.value.trim();
    if (!text) return;

    this.textarea.value = '';
    this.appendLocalBubble('Teacher', 'user', text);

    // Relays message over WS to the connected external agent
    if (this.wsBridge.connected) {
      this.wsBridge.sendResponse({
        type: 'agent.chat',
        sender: 'Teacher',
        role: 'user',
        content: text,
        timestamp: Date.now()
      });
    } else {
      setTimeout(() => {
        this.appendLocalBubble('System', 'assistant', 'Offline mode. Connect to relay to stream inputs to external agent.');
      }, 500);
    }
  }

  /**
   * Append bubble to DOM.
   */
  appendLocalBubble(sender, role, content) {
    const bubble = document.createElement('div');
    bubble.className = `agent-message ${role}`;

    const senderHeader = document.createElement('strong');
    senderHeader.style.display = 'block';
    senderHeader.style.fontSize = '11px';
    senderHeader.style.marginBottom = '4px';
    senderHeader.style.opacity = '0.7';
    senderHeader.innerText = sender;

    const bodyContent = document.createElement('span');
    bodyContent.innerText = content;

    bubble.appendChild(senderHeader);
    bubble.appendChild(bodyContent);

    this.chatBody.appendChild(bubble);
    this.chatBody.scrollTop = this.chatBody.scrollHeight;
  }

  /**
   * Log formatted streams to console.
   */
  logSystem(text, type = 'info') {
    const line = document.createElement('div');
    line.className = `agent-log-line ${type}`;
    line.innerText = `[${new Date().toLocaleTimeString()}] ${text}`;
    this.logBody.appendChild(line);
    this.logBody.scrollTop = this.logBody.scrollHeight;
  }
}
