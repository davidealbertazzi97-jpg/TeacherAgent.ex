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

    this.wsBridge = new AgentWebSocketBridge(this);
    this.activeFakeAgent = null;
    this.token = '';

    this.active = false;
    this.mode = 'power-user'; // Hardcode mode to bypass restrictions
    this.selectedAgent = null;

    this.container = null;
    this.toggleBtn = null;
    this.textarea = null;
    this.logBody = null;
    this.agentListContainer = null;
  }

  init() {
    this.injectStyles();
    this.createToggleButton();
    this.createSidebarMarkup();
    this.bindDOMEvents();
    this.registerDesktopEventListeners();

    this.logSystem('AI Control Center Sidebar loaded.', 'success');
  }

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

  createToggleButton() {
    // Replaced circular floating bubble with a clean vertical tab on the right edge
    const btn = document.createElement('button');
    btn.className = 'agent-sidebar-toggle-btn';
    btn.setAttribute('title', 'AI Power Agent Control Panel');
    btn.innerHTML = '<span>AI AGENT</span>';
    document.body.appendChild(btn);
    this.toggleBtn = btn;
  }

  createSidebarMarkup() {
    const sidebar = document.createElement('div');
    sidebar.className = 'agent-sidebar-container';
    sidebar.innerHTML = `
      <div class="agent-sidebar-header">
        <div class="agent-sidebar-title-wrapper">
          <icon class="agent-header-icon">psychology</icon>
          <div class="agent-sidebar-title">AI Control Center</div>
        </div>
        <button class="agent-sidebar-close-btn" title="Close Panel">&times;</button>
      </div>

      <div class="agent-instructions-panel">
        <label class="agent-label">Instructions / Goal for the AI Agent:</label>
        <textarea class="agent-textarea" placeholder="Describe what the AI should build (e.g. 'Crea una pagina sulle stelle con un quiz')..."></textarea>
      </div>

      <div class="agent-list-panel">
        <div class="agent-list-title">Detected Agents & Connection:</div>
        <div class="agent-list-items" id="agentListItems">
          <!-- Dynamically populated rows -->
        </div>
      </div>

      <div class="agent-sidebar-logs-panel">
        <div class="agent-log-header">
          <span>Execution logs:</span>
          <button class="agent-clear-logs-btn" title="Clear Logs">Clear</button>
        </div>
        <div class="agent-log-container" id="agentLogBody">
          <div class="agent-log-line success">System: Ready. Enter instructions above and connect an agent to begin!</div>
        </div>
      </div>
    `;

    document.body.appendChild(sidebar);
    this.container = sidebar;
    this.textarea = sidebar.querySelector('.agent-textarea');
    this.logBody = sidebar.querySelector('#agentLogBody');
    this.agentListContainer = sidebar.querySelector('#agentListItems');
  }

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
        this.selectedAgent = null;
        this.renderAgentList();
      });
    }
  }

  bindDOMEvents() {
    this.toggleBtn.addEventListener('click', () => this.toggle());
    this.container.querySelector('.agent-sidebar-close-btn').addEventListener('click', () => this.hide());

    this.container.querySelector('.agent-clear-logs-btn').addEventListener('click', () => {
      this.logBody.innerHTML = '';
      this.logSystem('System: Logs cleared.', 'info');
    });

    // Send prompt on Enter inside the textarea
    this.textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (this.wsBridge.connected) {
          this.handleSendMessage();
        } else {
          this.logSystem('Please connect an agent to send instructions.', 'warn');
        }
      }
    });
  }

  async handleSendMessage() {
    const text = this.textarea.value.trim();
    if (!text) return;

    this.textarea.value = '';
    this.logSystem(`[Istruzione inviata] ${text}`, 'success');

    if (this.wsBridge.connected) {
      this.wsBridge.sendResponse({
        type: 'agent.chat',
        sender: 'Teacher',
        role: 'user',
        content: text,
        timestamp: Date.now()
      });
    }
  }

  toggle() {
    if (this.active) this.hide();
    else this.show();
  }

  show() {
    this.active = true;
    this.container.classList.add('active');
    this.renderAgentList();
  }

  hide() {
    this.active = false;
    this.container.classList.remove('active');
  }

  updateConnectionStatus(isConnected) {
    // Kept for backward compatibility with AgentWebSocketBridge.js
  }

  async renderAgentList() {
    const container = this.agentListContainer;
    if (!container) return;
    container.innerHTML = '<div style="padding: 10px; text-align: center; color: var(--agent-text-muted); font-size: 11px;">Scanning host runtimes...</div>';

    let runtimes = [];
    if (window.electronAPI && typeof window.electronAPI.listAgentRuntimes === 'function') {
      try {
        runtimes = await window.electronAPI.listAgentRuntimes();
      } catch (err) {
        this.logSystem(`Failed to scan host runtimes: ${err.message}`, 'error');
      }
    }

    // Append simulated Fake Agent
    runtimes.unshift({
      id: 'fake',
      name: 'Fake Agent (Simulation)',
      available: true
    });

    container.innerHTML = '';

    runtimes.forEach(agent => {
      const row = document.createElement('div');
      row.className = 'agent-list-item';

      const info = document.createElement('div');
      info.className = 'agent-info';

      const dot = document.createElement('span');
      
      let dotClass = 'unavailable';
      let statusTitle = 'Not Installed';

      if (this.wsBridge.connected && this.selectedAgent === agent.id) {
        dotClass = 'connected';
        statusTitle = 'Connected';
      } else if (agent.available) {
        dotClass = 'available'; // Represents "Blue dot" styled as available
        statusTitle = 'Available';
      }

      dot.className = `status-dot ${dotClass}`;
      dot.setAttribute('title', statusTitle);

      const name = document.createElement('span');
      name.className = 'agent-name';
      name.innerText = agent.name;

      info.appendChild(dot);
      info.appendChild(name);

      const actionBtn = document.createElement('button');
      actionBtn.className = 'agent-item-connect-btn';
      
      if (this.wsBridge.connected && this.selectedAgent === agent.id) {
        actionBtn.innerText = 'Disconnect';
        actionBtn.classList.add('disconnect');
      } else {
        actionBtn.innerText = 'Connect';
        if (!agent.available) {
          actionBtn.disabled = true;
          actionBtn.style.opacity = '0.5';
          actionBtn.style.cursor = 'not-allowed';
        }
      }

      actionBtn.addEventListener('click', () => this.handleAgentConnection(agent));

      row.appendChild(info);
      row.appendChild(actionBtn);
      container.appendChild(row);
    });
  }

  async handleAgentConnection(agent) {
    if (this.wsBridge.connected && this.selectedAgent === agent.id) {
      this.logSystem(`Disconnecting from ${agent.name}...`, 'warn');
      if (this.activeFakeAgent) {
        this.activeFakeAgent.stop();
        this.activeFakeAgent = null;
      }
      if (window.electronAPI && typeof window.electronAPI.stopAgentRuntime === 'function') {
        await window.electronAPI.stopAgentRuntime();
      }
      this.wsBridge.disconnect();
      this.selectedAgent = null;
      this.renderAgentList();
    } else {
      if (this.wsBridge.connected) {
        this.logSystem('Disconnecting active agent session first...', 'warn');
        if (this.activeFakeAgent) {
          this.activeFakeAgent.stop();
          this.activeFakeAgent = null;
        }
        if (window.electronAPI && typeof window.electronAPI.stopAgentRuntime === 'function') {
          await window.electronAPI.stopAgentRuntime();
        }
        this.wsBridge.disconnect();
      }

      this.selectedAgent = agent.id;
      const pId = window.eXeLearning?.projectId || 'default-project';
      
      this.logSystem(`Connecting tool bridge for ${agent.name}...`);
      await this.wsBridge.connect(pId);

      if (this.wsBridge.connected) {
        this.logSystem(`Tool bridge established. Waking up clean session of ${agent.name}...`, 'success');
        
        const promptGoal = this.textarea.value.trim();
        if (promptGoal) {
          this.textarea.value = '';
          this.logSystem(`[CLI Prompt Payload] ${promptGoal}`, 'success');
        }

        if (agent.id === 'fake') {
          const fakeBrokerUrl = this.agentBridgeConfig?.wsUrl || this.wsBridge.wsUrl;
          this.activeFakeAgent = new FakeAgent(pId, this.token, (logMsg) => {
            this.logSystem(logMsg, 'info');
          }, fakeBrokerUrl);
          this.activeFakeAgent.start();
        } else {
          if (window.electronAPI && typeof window.electronAPI.startAgentRuntime === 'function') {
            const payload = {
              runtime: agent.id,
              projectId: pId,
              prompt: promptGoal
            };
            if (agent.id === 'custom') {
              payload.customCommand = prompt('Insert custom agent command:', 'node');
            }
            
            const res = await window.electronAPI.startAgentRuntime(payload);
            if (res && res.error) {
              this.logSystem(`Failed to launch ${agent.name}: ${res.error}`, 'error');
              this.wsBridge.disconnect();
              this.selectedAgent = null;
            } else {
              this.logSystem(`${agent.name} session awakened cleanly and active.`, 'success');
            }
          } else {
            this.logSystem('Real agent CLI execution is only supported in Desktop Electron mode.', 'error');
            this.wsBridge.disconnect();
            this.selectedAgent = null;
          }
        }
        this.renderAgentList();
      }
    }
  }

  appendLocalBubble(sender, role, content) {
    this.logSystem(`[${sender}] ${content}`, role === 'user' ? 'success' : 'info');
  }

  logSystem(text, type = 'info') {
    const line = document.createElement('div');
    line.className = `agent-log-line ${type}`;
    line.innerText = `[${new Date().toLocaleTimeString()}] ${text}`;
    this.logBody.appendChild(line);
    this.logBody.scrollTop = this.logBody.scrollHeight;
  }
}
