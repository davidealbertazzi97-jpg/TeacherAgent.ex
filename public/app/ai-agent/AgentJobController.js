import { AgentPlanner } from './AgentPlanner.js';
import { AgentExecutor } from './AgentExecutor.js';

export class AgentJobController {
  constructor(sidebar) {
    this.sidebar = sidebar;
    this.planner = new AgentPlanner(sidebar);
    this.executor = new AgentExecutor(sidebar.toolBus, sidebar);
    
    this.status = 'idle'; // 'idle', 'planning', 'executing', 'success', 'error'
    this.activePlan = null;

    // Register globally so the sidebar can access this singleton instance
    window.AgentJobControllerInstance = this;
  }

  /**
   * Main entrypoint triggered when the user submits a text query.
   */
  async processRequest(goalText) {
    const normalizedGoal = String(goalText || '').trim().toLowerCase();
    if (this.activePlan && this.status === 'idle' && ['proceed', 'execute', 'esegui', 'procedi'].includes(normalizedGoal)) {
      await this.executeActivePlan();
      return;
    }

    if (this.status === 'planning' || this.status === 'executing') {
      this.sidebar.logSystem('An action plan is already running. Please wait or cancel.', 'error');
      return;
    }

    this.status = 'planning';
    this.sidebar.logSystem(`Formulating course outline for: "${goalText}"`);

    try {
      const plan = await this.planner.generatePlan(goalText);
      if (!plan || !Array.isArray(plan) || plan.length === 0) {
        this.status = 'error';
        this.sidebar.logSystem('Planner generated an empty or invalid plan.', 'error');
        return;
      }

      this.activePlan = plan;
      this.sidebar.logSystem(`Plan successfully drafted (${plan.length} steps created).`);
      
      // Render plan preview in chat bubbles
      this.renderPlanPreview(plan);

      // If mode is autonomous, execute immediately
      if (this.sidebar.mode === 'autonomous') {
        await this.executeActivePlan();
      } else {
        // Assisted mode: ask user for confirmation
        this.status = 'idle';
        this.sidebar.logSystem('Plan draft ready. Type "proceed" or "procedi" to execute it.', 'info');
      }
    } catch (e) {
      this.status = 'error';
      this.sidebar.logSystem(`Planning failed: ${e.message}`, 'error');
    }
  }

  /**
   * Render the plan preview steps inside the chat pane.
   */
  renderPlanPreview(plan) {
    const card = document.createElement('div');
    card.className = 'agent-plan-card';
    
    let html = `<div class="agent-plan-title">📋 Drafted Action Plan:</div>`;
    plan.forEach((step, idx) => {
      html += `
        <div class="agent-plan-step" id="plan-step-${idx}">
          <icon>pending</icon> Step ${idx + 1}: ${step.action} - ${this.escapeHtml(step.title || 'Component')}
        </div>
      `;
    });

    card.innerHTML = html;
    this.sidebar.chatBody.appendChild(card);
    this.sidebar.chatBody.scrollTop = this.sidebar.chatBody.scrollHeight;
  }

  escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Execute the formulated action plan.
   */
  async executeActivePlan() {
    if (!this.activePlan) {
      this.sidebar.logSystem('No active plan available to execute.', 'error');
      return;
    }

    this.status = 'executing';
    
    try {
      const res = await this.executor.executePlan(this.activePlan);
      if (res.success) {
        this.status = 'success';
        
        // Final project validation
        const valRes = await this.sidebar.toolBus.validate_project();
        if (valRes.ok && valRes.result?.isValid) {
          this.sidebar.appendResponse('Assistant', 'assistant', 'Course chapter successfully created! The project was verified with zero integrity warnings.');
        } else {
          this.sidebar.appendResponse('Assistant', 'assistant', 'Course created with some validation warnings: ' + valRes.warnings.join(', '));
        }
      } else {
        this.status = 'error';
        this.sidebar.appendResponse('Assistant', 'assistant', `Execution halted due to step failure: ${res.error}`);
      }
    } catch (e) {
      this.status = 'error';
      this.sidebar.logSystem(`Execution crash: ${e.message}`, 'error');
    } finally {
      this.activePlan = null;
    }
  }
}
