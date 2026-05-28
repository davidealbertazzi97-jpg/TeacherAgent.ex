/**
 * IdeviceRegistry
 * Classifies eXeLearning iDevices into three agent compatibility categories:
 * - 'html-safe': Managed safely by generating raw HTML.
 * - 'schema-supported': Handled via structured payload adapters (quizzes, True/False).
 * - 'manual-only': Complex/legacy iDevices requiring teacher intervention.
 */
export class IdeviceRegistry {
  constructor(toolBus) {
    this.toolBus = toolBus;
    this.compatibilityMap = {
      // Yjs legacy aliases used by the collaborative document model.
      'FreeTextIdevice': { support: 'html-safe', createTool: 'create_html_idevice' },
      'MultichoiceIdevice': { support: 'schema-supported', createTool: 'create_quiz_idevice' },
      'TrueFalseIdevice': { support: 'schema-supported', createTool: 'create_truefalse_idevice' },
      'QuickquestionIdevice': { support: 'schema-supported', createTool: 'create_quickquestion_idevice' },

      // Real installed iDevice names from config.xml.
      'text': { support: 'html-safe', createTool: 'create_html_idevice' },
      'markdown-text': { support: 'html-safe', createTool: 'create_html_idevice' },
      'casestudy': { support: 'html-safe', createTool: 'create_html_idevice' },
      'example': { support: 'html-safe', createTool: 'create_html_idevice' },
      'udl-content': { support: 'html-safe', createTool: 'create_html_idevice' },
      'quick-questions': { support: 'schema-supported', createTool: 'create_quickquestion_idevice' },
      'quick-questions-multiple-choice': { support: 'schema-supported', createTool: 'create_quiz_idevice' },
      'trueorfalse': { support: 'schema-supported', createTool: 'create_truefalse_idevice' },
      'trivial': { support: 'schema-supported', createTool: 'create_quiz_idevice' },

      // Human labels retained for defensive compatibility with older tests/data.
      'Text': { support: 'html-safe', createTool: 'create_html_idevice' },
      'Markdown': { support: 'html-safe', createTool: 'create_html_idevice' },
      'Activity': { support: 'html-safe', createTool: 'create_html_idevice' },
      'Objectives': { support: 'html-safe', createTool: 'create_html_idevice' },

      // Complex iDevices remain manual until dedicated adapters exist.
      'InteractiveVideo': { support: 'manual-only', createTool: null },
      'interactive-video': { support: 'manual-only', createTool: null },
      'Slide': { support: 'manual-only', createTool: null },
      'slide': { support: 'manual-only', createTool: null }
    };
  }

  /**
   * Enriches and classifies all installed iDevices using current system configurations.
   */
  async getRegisteredIdevices() {
    const listRes = await this.toolBus.read_available_idevices();
    if (!listRes.ok) {
      throw new Error(`Failed to read available iDevices: ${listRes.error}`);
    }

    return listRes.result.map(idevice => {
      const config = this.compatibilityMap[idevice.name] || { support: 'manual-only', createTool: null };
      return {
        ...idevice,
        agentSupport: config.support,
        createTool: config.createTool
      };
    });
  }

  /**
   * Check if a specific iDevice is safe for the AI to generate HTML directly.
   */
  async isHtmlSafe(ideviceName) {
    const config = this.compatibilityMap[ideviceName];
    return config ? config.support === 'html-safe' : false;
  }

  /**
   * Check if an iDevice is supported by a specific transactional JSON schema.
   */
  async isSchemaSupported(ideviceName) {
    const config = this.compatibilityMap[ideviceName];
    return config ? config.support === 'schema-supported' : false;
  }
}
