/**
 * AgentPlanner
 * Translates natural language goals into a structured JSON execution plan
 * consisting of discrete tool actions.
 */
export class AgentPlanner {
  constructor(sidebar) {
    this.sidebar = sidebar;
  }

  /**
   * Generates a structured JSON plan for a user goal.
   * Falls back to high-quality mock templates if offline or API key is missing.
   */
  async generatePlan(goal) {
    const settings = this.getAiSettings();
    
    // Check if we can/should use the live LLM
    if (settings.apiKey && settings.apiKey !== 'ollama') {
      try {
        this.sidebar.logSystem('Connecting to LLM to formulate course plan...');
        const plan = await this.fetchLivePlan(goal, settings);
        if (plan && Array.isArray(plan)) {
          return plan;
        }
      } catch (e) {
        this.sidebar.logSystem(`LLM planning failed (${e.message}). Invoking safe template generator...`, 'error');
      }
    }

    // Fallback to local heuristic templates
    return this.generateHeuristicPlan(goal);
  }

  /**
   * Fetch settings from storage
   */
  getAiSettings() {
    const preset = localStorage.getItem('exe-ai-provider-preset') || 'mistral-codestral';
    const type = localStorage.getItem('exe-ai-provider-type') || 'openai-compatible';
    const baseUrl = localStorage.getItem('exe-ai-base-url') || 'https://api.mistral.ai/v1';
    const model = localStorage.getItem('exe-ai-model') || 'codestral-latest';
    const endpointPath = localStorage.getItem('exe-ai-endpoint-path') || '/chat/completions';
    const apiKey = sessionStorage.getItem('exe-ai-api-key') || '';
    
    return { preset, type, baseUrl, model, endpointPath, apiKey };
  }

  /**
   * Communicates with Elysia AI route to request structured JSON plans.
   */
  async fetchLivePlan(goal, settings) {
    const prompt = `
You are the eXeLearning AI Course Planner.
Given a learning goal, you must create a structured JSON plan containing the step-by-step actions to build the course.
You must respond ONLY with a raw JSON array of actions. Do not output any markdown formatting, backticks, or explanatory text.

The JSON array must be an array of objects matching these tool schemas:
1. {"action": "create_page", "title": "...", "parentId": null}
2. {"action": "create_block", "pageId": "...", "title": "..."}
3. {"action": "create_html_idevice", "pageId": "...", "blockId": "...", "title": "...", "html": "..."}

To reference pages, blocks or components created in earlier steps, use temporary IDs like "page-temp-0", "block-temp-0", "comp-temp-0". The executor maps these temporary IDs by creation order to the actual IDs.

Here is an example plan for a user request "Crea un capitolo sull'energia solare con intro":
[
  {"action": "create_page", "title": "Energia Solare", "parentId": null},
  {"action": "create_block", "pageId": "page-temp-0", "title": "Introduzione"},
  {"action": "create_html_idevice", "pageId": "page-temp-0", "blockId": "block-temp-0", "title": "Spiegazione", "html": "<h1>Energia Solare</h1><p>L'energia solare è...</p>"}
]

Goal: "${goal}"
`;

    const payload = {
      task: 'generate-html',
      prompt: prompt,
      provider: {
        type: settings.type,
        apiKey: settings.apiKey,
        baseUrl: settings.baseUrl,
        model: settings.model,
        endpointPath: settings.endpointPath
      }
    };

    const endpoint = window.eXeLearning?.app?.composeUrl 
      ? window.eXeLearning.app.composeUrl('/api/ai/generate-html')
      : '/api/ai/generate-html';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    const data = await response.json();
    if (data.error) throw new Error(data.error);

    // Parse JSON safely from returned completion
    const cleanedText = (data.html || '').replace(/```json|```/g, '').trim();
    return this.validatePlan(JSON.parse(cleanedText));
  }

  validatePlan(plan) {
    if (!Array.isArray(plan)) {
      throw new Error('Planner response is not a JSON array');
    }

    const allowedActions = new Set([
      'create_page',
      'rename_page',
      'move_page',
      'create_block',
      'create_html_idevice',
      'update_idevice_html',
      'delete_page',
      'delete_idevice'
    ]);

    const sanitized = plan
      .filter(step => step && typeof step === 'object' && allowedActions.has(step.action))
      .slice(0, 40);

    if (sanitized.length === 0) {
      throw new Error('Planner response did not contain supported actions');
    }

    return sanitized;
  }

  /**
   * Generates high-quality templates for immediate demo purposes.
   */
  generateHeuristicPlan(goal) {
    this.sidebar.logSystem('Generating heuristic course plan...', 'info');
    const lower = goal.toLowerCase();

    if (lower.includes('vulcan') || lower.includes('geograf')) {
      return [
        { action: 'create_page', title: 'I Vulcani del Pianeta', parentId: null },
        { action: 'create_block', pageId: 'page-temp-0', title: 'Cosa sono i Vulcani' },
        {
          action: 'create_html_idevice',
          pageId: 'page-temp-0',
          blockId: 'block-temp-0',
          title: 'Introduzione Teorica',
          html: `
            <div style="padding: 15px; border-left: 4px solid #ff5500; background: rgba(255,85,0,0.05); border-radius: 4px;">
              <h2>🌋 Introduzione ai Vulcani</h2>
              <p>Un vulcano è una frattura della crosta terrestre da cui fuoriesce il magma, roccia fusa ad altissime temperature proveniente dal mantello terrestre.</p>
              <h3>Parti principali di un vulcano:</h3>
              <ul>
                <li><strong>Camera magmatica:</strong> Il serbatoio sotterraneo dove si accumula il magma.</li>
                <li><strong>Condotto principale:</strong> Il canale attraverso cui il magma sale in superficie.</li>
                <li><strong>Cratere:</strong> L'apertura esterna da cui fuoriesce la lava.</li>
              </ul>
            </div>
          `
        },
        { action: 'create_page', title: 'Quiz e Verifica', parentId: 'page-temp-0' },
        { action: 'create_block', pageId: 'page-temp-1', title: 'Verifica le tue conoscenze' },
        {
          action: 'create_html_idevice',
          pageId: 'page-temp-1',
          blockId: 'block-temp-1',
          title: 'Quiz Geologia',
          html: `
            <div style="border: 1px solid #ddd; padding: 15px; border-radius: 8px;">
              <h3>❓ Domanda a Scelta Multipla</h3>
              <p>Qual è la differenza principale tra <strong>magma</strong> e <strong>lava</strong>?</p>
              <form style="display: flex; flex-direction: column; gap: 8px;">
                <label><input type="radio" name="q1"> Il magma è roccia fusa sottoterra, la lava è fuoriuscita in superficie.</label>
                <label><input type="radio" name="q1"> La lava è più calda del magma.</label>
                <label><input type="radio" name="q1"> Non c'è alcuna differenza.</label>
              </form>
            </div>
          `
        }
      ];
    }

    // Default general course plan
    return [
      { action: 'create_page', title: 'Nuovo Percorso Didattico', parentId: null },
      { action: 'create_block', pageId: 'page-temp-0', title: 'Modulo 1' },
      {
        action: 'create_html_idevice',
        pageId: 'page-temp-0',
        blockId: 'block-temp-0',
        title: 'Benvenuto',
        html: `
          <div style="padding: 15px; border-left: 4px solid #3388ff; background: rgba(51,136,255,0.05); border-radius: 4px;">
            <h2>📚 Benvenuto nel Corso Nativi Digitali</h2>
            <p>Questo percorso didattico è stato progettato con l'ausilio di eXeLearning AI Co-Author per supportare i docenti nella co-creazione di contenuti didattici interattivi.</p>
          </div>
        `
      }
    ];
  }
}
