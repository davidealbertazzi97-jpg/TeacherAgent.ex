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
    
    // State management
    this.selectedAgentId = 'fake';
    this.connectedAgentId = null;
    this.availableAgents = [];
    this.isDropdownOpen = false;

    this.container = null;
    this.toggleBtn = null;
    this.textarea = null;
    this.chatThread = null;
    this.dropdownTrigger = null;
    this.dropdownMenu = null;
    this.connectBtn = null;
  }

  init() {
    this.injectStyles();
    this.createToggleButton();
    this.createSidebarMarkup();
    this.bindDOMEvents();
    this.registerDesktopEventListeners();

    // Initial system introduction action badges
    this.appendAction('AI Co-Author Center loaded.', 'success');
    this.appendAction('Ready. Select an agent from the dropdown at the top and connect.', 'info');

    // Automatically connect the WebSocket tool bridge to enable out-of-the-box external agent control
    const pId = window.eXeLearning?.projectId || 'default-project';
    this.wsBridge.connect(pId).catch(err => {
      console.warn('[AgentSidebar] Auto-connect bridge failed:', err);
    });

    // Initial runtimes scan
    this.scanAndRenderRuntimes();
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
          <div class="agent-sidebar-title">AI Assistant</div>
        </div>
        <button class="agent-sidebar-close-btn" title="Close Panel">&times;</button>
      </div>

      <div class="agent-selector-panel">
        <div class="agent-dropdown-wrapper">
          <button class="agent-dropdown-trigger" id="agentDropdownTrigger">
            <span class="status-dot unavailable"></span>
            <span class="trigger-label">Simulated Agent</span>
            <icon class="dropdown-arrow">expand_more</icon>
          </button>
          <div class="agent-dropdown-menu" id="agentDropdownMenu">
            <!-- Populated dynamically -->
          </div>
          <button class="agent-connect-btn" id="agentConnectBtn">Connect</button>
        </div>
      </div>

      <div class="agent-chat-messages-area" id="agentChatThread">
        <!-- Unified scrollable message thread -->
      </div>

      <div class="agent-chat-input-container">
        <textarea class="agent-chat-input" placeholder="Type a message or describe a goal..." rows="1"></textarea>
        <button class="agent-chat-send-btn" title="Send Goal">
          <icon>send</icon>
        </button>
      </div>
    `;

    document.body.appendChild(sidebar);
    this.container = sidebar;
    this.textarea = sidebar.querySelector('.agent-chat-input');
    this.chatThread = sidebar.querySelector('#agentChatThread');
    this.dropdownTrigger = sidebar.querySelector('#agentDropdownTrigger');
    this.dropdownMenu = sidebar.querySelector('#agentDropdownMenu');
    this.connectBtn = sidebar.querySelector('#agentConnectBtn');
  }

  registerDesktopEventListeners() {
    if (window.electronAPI && typeof window.electronAPI.onAgentRuntimeOutput === 'function') {
      window.electronAPI.onAgentRuntimeOutput(({ data, type }) => {
        const cleanMsg = data.trim();
        if (cleanMsg) {
          // Output lines as technical timeline badges inside the main chat flow
          this.appendAction(`[CLI ${type}] ${cleanMsg}`, type === 'stderr' ? 'error' : 'tool');
        }
      });
    }

    if (window.electronAPI && typeof window.electronAPI.onAgentRuntimeClosed === 'function') {
      window.electronAPI.onAgentRuntimeClosed(({ code, error }) => {
        if (error) {
          this.appendAction(`Agent CLI crashed: ${error}`, 'error');
        } else {
          this.appendAction(`Agent CLI completed with exit code: ${code}`, 'warn');
        }
        this.wsBridge.disconnect();
        this.connectedAgentId = null;
        this.updateConnectButtonUI();
        this.scanAndRenderRuntimes();
      });
    }
  }

  bindDOMEvents() {
    this.toggleBtn.addEventListener('click', () => this.toggle());
    this.container.querySelector('.agent-sidebar-close-btn').addEventListener('click', () => this.hide());

    // Dropdown toggle
    this.dropdownTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleDropdown();
    });

    // Close dropdown on click outside
    document.addEventListener('click', () => {
      if (this.isDropdownOpen) {
        this.closeDropdown();
      }
    });

    // Connect button click
    this.connectBtn.addEventListener('click', () => {
      const selectedAgent = this.availableAgents.find(a => a.id === this.selectedAgentId);
      if (selectedAgent) {
        this.handleAgentConnection(selectedAgent);
      }
    });

    // Autogrow textarea as user types
    this.textarea.addEventListener('input', () => {
      this.textarea.style.height = 'auto';
      const newHeight = Math.min(this.textarea.scrollHeight, 120);
      this.textarea.style.height = `${newHeight}px`;
    });

    // Submit on Enter (without Shift)
    this.textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSendMessage();
      }
    });

    // Submit on Send Button click
    this.container.querySelector('.agent-chat-send-btn').addEventListener('click', () => {
      this.handleSendMessage();
    });
  }

  toggleDropdown() {
    if (this.isDropdownOpen) {
      this.closeDropdown();
    } else {
      this.openDropdown();
    }
  }

  openDropdown() {
    this.isDropdownOpen = true;
    this.dropdownMenu.classList.add('active');
    this.dropdownTrigger.querySelector('.dropdown-arrow').innerText = 'expand_less';
  }

  closeDropdown() {
    this.isDropdownOpen = false;
    this.dropdownMenu.classList.remove('active');
    this.dropdownTrigger.querySelector('.dropdown-arrow').innerText = 'expand_more';
  }

  async handleSendMessage() {
    const text = this.textarea.value.trim();
    if (!text) return;

    // Reset textarea size
    this.textarea.value = '';
    this.textarea.style.height = 'auto';

    // 1. Render User Message bubble
    this.appendMessage('You', 'user', text);

    // 2. Forward to WS Bridge if active
    if (this.wsBridge.connected) {
      this.wsBridge.sendResponse({
        type: 'agent.chat',
        sender: 'Teacher',
        role: 'user',
        content: text,
        timestamp: Date.now()
      });
    } else {
      this.appendAction('Not connected. Select an agent at the top and connect to start the conversation.', 'warn');
    }
  }

  toggle() {
    if (this.active) this.hide();
    else this.show();
  }

  show() {
    this.active = true;
    this.container.classList.add('active');
    this.scanAndRenderRuntimes();
  }

  hide() {
    this.active = false;
    this.container.classList.remove('active');
  }

  updateConnectionStatus(isConnected) {
    if (!isConnected) {
      this.connectedAgentId = null;
    }
    this.updateConnectButtonUI();
    this.scanAndRenderRuntimes();
  }

  async scanAndRenderRuntimes() {
    let runtimes = [];
    if (window.electronAPI && typeof window.electronAPI.listAgentRuntimes === 'function') {
      try {
        runtimes = await window.electronAPI.listAgentRuntimes();
      } catch (err) {
        this.appendAction(`Failed to scan host runtimes: ${err.message}`, 'error');
      }
    }

    // Append simulated Fake Agent
    runtimes.unshift({
      id: 'fake',
      name: 'Fake Agent (Simulation)',
      available: true
    });

    this.availableAgents = runtimes;

    // Populate dropdown menu
    this.dropdownMenu.innerHTML = '';
    runtimes.forEach(agent => {
      const item = document.createElement('div');
      item.className = 'agent-dropdown-item';
      if (agent.id === this.selectedAgentId) {
        item.classList.add('selected');
      }
      if (!agent.available) {
        item.classList.add('disabled');
      }

      let dotClass = 'unavailable';
      if (this.wsBridge.connected && this.connectedAgentId === agent.id) {
        dotClass = 'connected';
      } else if (agent.available) {
        dotClass = 'available';
      }

      item.innerHTML = `
        <span class="status-dot ${dotClass}"></span>
        <span class="item-name">${agent.name}</span>
      `;

      if (agent.available) {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          this.selectAgent(agent.id);
          this.closeDropdown();
        });
      }

      this.dropdownMenu.appendChild(item);
    });

    // Update active trigger text & dot
    const activeAgent = runtimes.find(a => a.id === this.selectedAgentId) || runtimes[0];
    const triggerLabel = this.dropdownTrigger.querySelector('.trigger-label');
    const triggerDot = this.dropdownTrigger.querySelector('.status-dot');

    triggerLabel.innerText = activeAgent.name;
    triggerDot.className = 'status-dot';
    
    let activeDotClass = 'unavailable';
    if (this.wsBridge.connected && this.connectedAgentId === activeAgent.id) {
      activeDotClass = 'connected';
    } else if (activeAgent.available) {
      activeDotClass = 'available';
    }
    triggerDot.classList.add(activeDotClass);

    this.updateConnectButtonUI();
  }

  selectAgent(agentId) {
    this.selectedAgentId = agentId;
    this.scanAndRenderRuntimes();
  }

  updateConnectButtonUI() {
    if (this.wsBridge.connected && this.connectedAgentId === this.selectedAgentId) {
      this.connectBtn.innerText = 'Disconnect';
      this.connectBtn.className = 'agent-connect-btn disconnect';
      this.connectBtn.disabled = false;
    } else {
      this.connectBtn.innerText = 'Connect';
      this.connectBtn.className = 'agent-connect-btn';
      
      const activeAgent = this.availableAgents.find(a => a.id === this.selectedAgentId);
      if (activeAgent && !activeAgent.available) {
        this.connectBtn.disabled = true;
      } else {
        this.connectBtn.disabled = false;
      }
    }
  }

  async handleAgentConnection(agent) {
    // 1. Handle Disconnection
    if (this.wsBridge.connected && this.connectedAgentId === agent.id) {
      this.appendAction(`Disconnecting from ${agent.name}...`, 'warn');
      if (this.activeFakeAgent) {
        this.activeFakeAgent.stop();
        this.activeFakeAgent = null;
      }
      if (window.electronAPI && typeof window.electronAPI.stopAgentRuntime === 'function') {
        await window.electronAPI.stopAgentRuntime();
      }
      this.wsBridge.disconnect();
      this.connectedAgentId = null;
      this.scanAndRenderRuntimes();
      return;
    }

    // 2. Handle Connection (disconnect active session first if any)
    if (this.wsBridge.connected) {
      this.appendAction('Disconnecting active agent session first...', 'warn');
      if (this.activeFakeAgent) {
        this.activeFakeAgent.stop();
        this.activeFakeAgent = null;
      }
      if (window.electronAPI && typeof window.electronAPI.stopAgentRuntime === 'function') {
        await window.electronAPI.stopAgentRuntime();
      }
      this.wsBridge.disconnect();
      this.connectedAgentId = null;
    }

    this.selectedAgentId = agent.id;
    const pId = window.eXeLearning?.projectId || 'default-project';
    
    this.appendAction(`Connecting tool bridge for ${agent.name}...`, 'info');
    await this.wsBridge.connect(pId);

    if (this.wsBridge.connected) {
      this.connectedAgentId = agent.id;
      this.appendAction(`Tool bridge established. Waking up ${agent.name}...`, 'success');
      
      if (agent.id === 'fake') {
        const fakeBrokerUrl = this.agentBridgeConfig?.wsUrl || this.wsBridge.wsUrl;
        this.activeFakeAgent = new FakeAgent(pId, this.token, (logMsg) => {
          this.appendAction(logMsg, 'info');
        }, fakeBrokerUrl);
        this.activeFakeAgent.start();
      } else {
        if (window.electronAPI && typeof window.electronAPI.startAgentRuntime === 'function') {
          const payload = {
            runtime: agent.id,
            projectId: pId,
            prompt: '' // Prompt will be built dynamically during live chat
          };
          if (agent.id === 'custom') {
            payload.customCommand = prompt('Insert custom agent command:', 'node');
          }
          
          const res = await window.electronAPI.startAgentRuntime(payload);
          if (res && res.error) {
            this.appendAction(`Failed to launch ${agent.name}: ${res.error}`, 'error');
            this.wsBridge.disconnect();
            this.connectedAgentId = null;
          } else {
            this.appendAction(`${agent.name} connected and ready for dialogue.`, 'success');
          }
        } else {
          this.appendAction('Real agent CLI execution is only supported in Desktop Electron mode.', 'error');
          this.wsBridge.disconnect();
          this.connectedAgentId = null;
        }
      }
      this.scanAndRenderRuntimes();
    }
  }

  /**
   * Append dialogue message bubble ChatGPT-style (User on right, Agent on left)
   */
  appendMessage(sender, role, content) {
    const bubble = document.createElement('div');
    bubble.className = `agent-bubble ${role}`;

    // Sender Label
    const senderLabel = document.createElement('div');
    senderLabel.className = 'agent-bubble-sender';
    senderLabel.innerText = sender;

    // Body content (Support HTML formatting or raw texts)
    const textBody = document.createElement('div');
    textBody.className = 'agent-bubble-text';
    textBody.innerHTML = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>')
      // Sleek auto-formatting for code or bold markups
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    bubble.appendChild(senderLabel);
    bubble.appendChild(textBody);

    this.chatThread.appendChild(bubble);
    this.chatThread.scrollTop = this.chatThread.scrollHeight;
  }

  /**
   * Map for backward compatibility and real-time chat bubble injection from broker
   */
  appendLocalBubble(sender, role, content) {
    this.appendMessage(sender, role, content);
  }

  /**
   * Technical timeline action badge / inline log
   */
  appendAction(text, type = 'info') {
    const pill = document.createElement('div');
    pill.className = `agent-chat-action-badge ${type}`;
    
    // Choose clean visual icon based on type
    let iconName = 'info';
    if (type === 'success') iconName = 'check_circle';
    else if (type === 'error') iconName = 'error';
    else if (type === 'warn') iconName = 'warning';
    else if (type === 'tool') iconName = 'build';

    pill.innerHTML = `
      <icon class="action-icon">${iconName}</icon>
      <span class="action-text">${text}</span>
    `;

    this.chatThread.appendChild(pill);
    this.chatThread.scrollTop = this.chatThread.scrollHeight;
  }

  /**
   * Backward compatible routing for bridge/broker log outputs
   */
  logSystem(text, type = 'info') {
    // Unify all system stdout logs as visual timeline action badges!
    this.appendAction(text, type);
  }
}
