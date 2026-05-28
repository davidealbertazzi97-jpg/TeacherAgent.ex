/**
 * AgentExecutor
 * Sequentially executes a structured JSON action plan, resolving temporary
 * ID references on-the-fly and validating structural mutations.
 */
export class AgentExecutor {
  constructor(toolBus, sidebar) {
    this.toolBus = toolBus;
    this.sidebar = sidebar;
    this.tempIdMap = {}; // Maps "page-temp-X" -> "actual-page-id", etc.
    this.tempCounters = { page: 0, block: 0, comp: 0 };
  }

  /**
   * Executes the entire array of actions in the plan.
   * Exposes standard step progress logging.
   */
  async executePlan(plan) {
    this.tempIdMap = {};
    this.tempCounters = { page: 0, block: 0, comp: 0 };
    const results = [];

    this.sidebar.logSystem(`Starting plan execution (${plan.length} steps)...`, 'info');

    for (let i = 0; i < plan.length; i++) {
      const step = plan[i];
      this.sidebar.logSystem(`Executing step ${i + 1}/${plan.length}: ${step.action}...`, 'tool');
      
      try {
        const res = await this.executeStep(step, i);
        results.push({ step, result: res });

        if (!res.ok) {
          this.sidebar.logSystem(`Step ${i + 1} failed: ${res.error}`, 'error');
          // Self-repair or halt based on configuration
          return { success: false, results, error: res.error };
        } else {
          this.sidebar.logSystem(`Step ${i + 1} completed successfully.`, 'success');
        }
      } catch (e) {
        this.sidebar.logSystem(`Step ${i + 1} crashed: ${e.message}`, 'error');
        return { success: false, results, error: e.message };
      }
    }

    this.sidebar.logSystem('Plan execution complete!', 'success');
    return { success: true, results };
  }

  /**
   * Resolves temporary ID references in tool parameters.
   */
  resolveArguments(args, actionIndex) {
    const resolved = { ...args };

    // Handle string inputs containing temp IDs
    const resolveValue = (val) => {
      if (typeof val === 'string' && this.tempIdMap[val]) {
        return this.tempIdMap[val];
      }
      return val;
    };

    if (resolved.pageId) resolved.pageId = resolveValue(resolved.pageId);
    if (resolved.parentId) resolved.parentId = resolveValue(resolved.parentId);
    if (resolved.blockId) resolved.blockId = resolveValue(resolved.blockId);
    if (resolved.componentId) resolved.componentId = resolveValue(resolved.componentId);

    return resolved;
  }

  storeTempId(kind, step, actualId) {
    const explicitId = step.tempId || step.id;
    const fallbackKey = `${kind}-temp-${this.tempCounters[kind]++}`;

    this.tempIdMap[fallbackKey] = actualId;
    if (explicitId) {
      this.tempIdMap[explicitId] = actualId;
    }

    if (kind === 'page' && step.pageId) {
      this.tempIdMap[step.pageId] = actualId;
    }
    if (kind === 'block' && step.blockId) {
      this.tempIdMap[step.blockId] = actualId;
    }
    if (kind === 'comp' && step.componentId) {
      this.tempIdMap[step.componentId] = actualId;
    }
  }

  /**
   * Resolves and executes a single tool step.
   */
  async executeStep(step, index) {
    const action = step.action;
    const rawArgs = { ...step };
    delete rawArgs.action;

    // Resolve any placeholders
    const resolvedArgs = this.resolveArguments(rawArgs, index);

    let res;
    switch (action) {
      case 'create_page':
        res = await this.toolBus.create_page(resolvedArgs);
        if (res.ok && res.result?.pageId) {
          this.storeTempId('page', step, res.result.pageId);
        }
        break;

      case 'rename_page':
        res = await this.toolBus.rename_page(resolvedArgs);
        break;

      case 'move_page':
        res = await this.toolBus.move_page(resolvedArgs);
        break;

      case 'create_block':
        res = await this.toolBus.create_block(resolvedArgs);
        if (res.ok && res.result?.blockId) {
          this.storeTempId('block', step, res.result.blockId);
        }
        break;

      case 'create_html_idevice':
        res = await this.toolBus.create_html_idevice(resolvedArgs);
        if (res.ok && res.result?.componentId) {
          this.storeTempId('comp', step, res.result.componentId);
        }
        break;

      case 'update_idevice_html':
        res = await this.toolBus.update_idevice_html(resolvedArgs);
        break;

      case 'delete_page':
        res = await this.toolBus.delete_page(resolvedArgs);
        break;

      case 'delete_idevice':
        res = await this.toolBus.delete_idevice(resolvedArgs);
        break;

      default:
        res = { ok: false, error: `Unknown planning action: ${action}` };
    }

    return res;
  }
}
