import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentExecutor } from './AgentExecutor.js';

describe('AgentExecutor', () => {
  let toolBus;
  let sidebar;
  let executor;

  beforeEach(() => {
    toolBus = {
      create_page: vi.fn().mockResolvedValue({ ok: true, result: { pageId: 'page-real-1' } }),
      create_block: vi.fn().mockResolvedValue({ ok: true, result: { blockId: 'block-real-1' } }),
      create_html_idevice: vi.fn().mockResolvedValue({ ok: true, result: { componentId: 'comp-real-1' } }),
      update_idevice_html: vi.fn(),
      rename_page: vi.fn(),
      move_page: vi.fn(),
      delete_page: vi.fn(),
      delete_idevice: vi.fn()
    };
    sidebar = { logSystem: vi.fn() };
    executor = new AgentExecutor(toolBus, sidebar);
  });

  it('maps creation-order temporary IDs instead of action indexes', async () => {
    const plan = [
      { action: 'create_page', title: 'Vulcani', parentId: null },
      { action: 'create_block', pageId: 'page-temp-0', title: 'Teoria' },
      {
        action: 'create_html_idevice',
        pageId: 'page-temp-0',
        blockId: 'block-temp-0',
        title: 'Introduzione',
        html: '<p>Vulcani</p>'
      }
    ];

    const result = await executor.executePlan(plan);

    expect(result.success).toBe(true);
    expect(toolBus.create_block).toHaveBeenCalledWith({ pageId: 'page-real-1', title: 'Teoria' });
    expect(toolBus.create_html_idevice).toHaveBeenCalledWith({
      pageId: 'page-real-1',
      blockId: 'block-real-1',
      title: 'Introduzione',
      html: '<p>Vulcani</p>'
    });
  });

  it('maps explicit tempId aliases when provided by the planner', async () => {
    const plan = [
      { action: 'create_page', tempId: 'intro-page', title: 'Intro', parentId: null },
      { action: 'create_block', tempId: 'intro-block', pageId: 'intro-page', title: 'Blocco' },
      {
        action: 'create_html_idevice',
        pageId: 'intro-page',
        blockId: 'intro-block',
        title: 'Testo',
        html: '<p>Contenuto</p>'
      }
    ];

    const result = await executor.executePlan(plan);

    expect(result.success).toBe(true);
    expect(toolBus.create_block).toHaveBeenCalledWith({ tempId: 'intro-block', pageId: 'page-real-1', title: 'Blocco' });
    expect(toolBus.create_html_idevice).toHaveBeenCalledWith({
      pageId: 'page-real-1',
      blockId: 'block-real-1',
      title: 'Testo',
      html: '<p>Contenuto</p>'
    });
  });
});
