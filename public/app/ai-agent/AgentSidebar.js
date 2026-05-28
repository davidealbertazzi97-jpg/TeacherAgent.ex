import { AgentToolBus } from './AgentToolBus.js';
import { IdeviceRegistry } from './IdeviceRegistry.js';

export class AgentSidebar {
  constructor(app) {
    this.app = app;
    this.projectManager = app.project;
    this.toolBus = new AgentToolBus(this.projectManager);
    this.registry = new IdeviceRegistry(this.toolBus);
    
    this.active = false;
    this.mode = 'assisted'; // 'assisted' or 'autonomous'
    this.yChatArray = null;
    this._unsubscribeYjs = null;

    this.container = null;
    this.toggleBtn = null;
    this.chatBody = null;
    this.textarea = null;
    this.logBody = null;
  }

  /**
   * Initialise the sidebar UI components and styles.
   */
  init() {
    this.injectStyles();
    this.createToggleButton();
    this.createSidebarMarkup();
    this.bindDOMEvents();

    // Lazy import and bind the Job Controller
    import('./AgentJobController.js').then(({ AgentJobController }) => {
      this.controller = new AgentJobController(this);
    });

    this.logSystem('eXeLearning AI Co-Author initialized.');
    this.logSystem('Mode set to: Assisted');
  }

  /**
   * Inject the CSS stylesheet.
   */
  injectStyles() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = this.app?.composeUrl
      ? this.app.composeUrl('/app/ai-agent/AgentSidebar.css')
      : '/app/ai-agent/AgentSidebar.css';
    document.head.appendChild(link);
  }

  /**
   * Create the floating toggle button.
   */
  createToggleButton() {
    const btn = document.createElement('button');
    btn.className = 'agent-sidebar-toggle-btn';
    btn.setAttribute('title', 'AI Co-Author Chat');
    btn.innerHTML = '<icon>forum</icon>';
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
          <div class="agent-sidebar-avatar-glow">
            <icon>smart_toy</icon>
          </div>
          <span class="agent-sidebar-title">eXe AI Co-Author</span>
        </div>
        <button class="agent-sidebar-close-btn">&times;</button>
      </div>

      <div class="agent-sidebar-mode-selector">
        <button class="agent-mode-btn active" data-mode="assisted">
          <icon>rule</icon> Assisted
        </button>
        <button class="agent-mode-btn" data-mode="autonomous">
          <icon>bolt</icon> Autonomous
        </button>
      </div>

      <div class="agent-sidebar-chat" id="agentChatBody">
        <div class="agent-message assistant">
          Hello! I am your AI Co-Author. Type in a goal (e.g. "Create a volcano chapter with an intro and quiz") and I can help construct it!
        </div>
      </div>

      <div class="agent-sidebar-input-form">
        <div class="agent-log-container" id="agentLogBody">
          <div class="agent-log-line success">System: Ready to assist.</div>
        </div>
        <div class="agent-input-container">
          <textarea class="agent-textarea" placeholder="Describe your course goal..."></textarea>
          <button class="agent-send-btn" id="agentSendBtn">
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
  }

  /**
   * Bind DOM interactivity.
   */
  bindDOMEvents() {
    // Open/Close toggle
    this.toggleBtn.addEventListener('click', () => this.toggle());
    this.container.querySelector('.agent-sidebar-close-btn').addEventListener('click', () => this.hide());

    // Mode switching
    const modeBtns = this.container.querySelectorAll('.agent-mode-btn');
    modeBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        modeBtns.forEach(b => b.classList.remove('active'));
        const targetBtn = e.currentTarget;
        targetBtn.classList.add('active');
        this.mode = targetBtn.dataset.mode;
        this.logSystem(`Mode changed to: ${this.mode === 'assisted' ? 'Assisted' : 'Autonomous'}`);
      });
    });

    // Send on click
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
   * Bind the chat sync log to the active Yjs CRDT Array.
   */
  bindYjs(bridge) {
    if (this._unsubscribeYjs) {
      this._unsubscribeYjs();
    }

    try {
      const docManager = bridge?.getDocumentManager();
      const yDoc = docManager?.yDoc;
      if (!yDoc) return;

      this.yChatArray = yDoc.getArray('chat-messages');
      
      const observer = () => {
        this.renderChatMessages();
      };
      
      this.yChatArray.observe(observer);
      this._unsubscribeYjs = () => {
        this.yChatArray.unobserve(observer);
      };

      this.logSystem('Yjs CRDT chat sync bound.');
      this.renderChatMessages();
    } catch (e) {
      console.warn('[AgentSidebar] Failed to bind Yjs array:', e);
    }
  }

  /**
   * Unbind Yjs observer.
   */
  unbindYjs() {
    if (this._unsubscribeYjs) {
      this._unsubscribeYjs();
      this._unsubscribeYjs = null;
    }
    this.yChatArray = null;
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
    
    // Check if Yjs is active and bind if needed
    if (this.projectManager?.isYjsEnabled() && !this.yChatArray) {
      const bridge = this.projectManager.getYjsBridge();
      this.bindYjs(bridge);
    }
  }

  /**
   * Hide sidebar.
   */
  hide() {
    this.active = false;
    this.container.classList.remove('active');
  }

  /**
   * Standard chat send event handler.
   */
  async handleSendMessage() {
    const text = this.textarea.value.trim();
    if (!text) return;

    this.textarea.value = '';

    // If Yjs is bound, we push to CRDT so all collaborators see it
    if (this.yChatArray) {
      this.yChatArray.push([{
        sender: this.app?.user?.name || 'Teacher',
        role: 'user',
        content: text,
        timestamp: Date.now()
      }]);
    } else {
      // Local fallback if Yjs not ready
      this.appendLocalBubble('Teacher', 'user', text);
    }

    this.logSystem('User requested goal.');

    // Fire the controller hook (integrated in Phase 4)
    if (window.AgentJobControllerInstance) {
      window.AgentJobControllerInstance.processRequest(text);
    } else {
      // Temporary stub response before Planner is active
      setTimeout(() => {
        this.appendResponse('Assistant', 'assistant', `Received: "${text}". The Autonomous planner is boot-loading...`);
      }, 1000);
    }
  }

  /**
   * Append a local fallback bubble to DOM (no Yjs sync).
   */
  appendLocalBubble(sender, role, content) {
    const bubble = document.createElement('div');
    bubble.className = `agent-message ${role}`;
    bubble.innerText = content;
    this.chatBody.appendChild(bubble);
    this.chatBody.scrollTop = this.chatBody.scrollHeight;
  }

  /**
   * Append assistant reply.
   */
  appendResponse(sender, role, content) {
    if (this.yChatArray) {
      this.yChatArray.push([{
        sender,
        role,
        content,
        timestamp: Date.now()
      }]);
    } else {
      this.appendLocalBubble(sender, role, content);
    }
  }

  /**
   * Synchronises chat UI bubbles with the CRDT Array values.
   */
  renderChatMessages() {
    if (!this.yChatArray) return;

    // Clear and rebuild chat
    this.chatBody.innerHTML = '';
    
    // Add default welcome message
    const welcome = document.createElement('div');
    welcome.className = 'agent-message assistant';
    welcome.innerText = 'Hello! I am your AI Co-Author. Type in a goal (e.g. "Create a volcano chapter with an intro and quiz") and I can help construct it!';
    this.chatBody.appendChild(welcome);

    for (let i = 0; i < this.yChatArray.length; i++) {
      const msg = this.yChatArray.get(i);
      if (!msg) continue;

      const bubble = document.createElement('div');
      bubble.className = `agent-message ${msg.role}`;
      bubble.innerText = msg.content;
      this.chatBody.appendChild(bubble);
    }

    this.chatBody.scrollTop = this.chatBody.scrollHeight;
  }

  /**
   * Appends formatting logs into the bottom panel.
   */
  logSystem(text, type = 'info') {
    const line = document.createElement('div');
    line.className = `agent-log-line ${type}`;
    line.innerText = `[${new Date().toLocaleTimeString()}] ${text}`;
    this.logBody.appendChild(line);
    this.logBody.scrollTop = this.logBody.scrollHeight;
  }
}
