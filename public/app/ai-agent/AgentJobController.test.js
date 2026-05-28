import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentJobController } from './AgentJobController.js';

describe('AgentJobController', () => {
  let mockSidebar;
  let jobController;

  beforeEach(() => {
    // Mock sidebar instance
    mockSidebar = {
      mode: 'autonomous',
      logSystem: vi.fn(),
      appendResponse: vi.fn(),
      chatBody: {
        appendChild: vi.fn(),
        scrollHeight: 100,
        scrollTop: 0
      },
      toolBus: {
        create_page: vi.fn().mockResolvedValue({ ok: true, result: { pageId: 'page-1' } }),
        create_block: vi.fn().mockResolvedValue({ ok: true, result: { blockId: 'block-1' } }),
        create_html_idevice: vi.fn().mockResolvedValue({ ok: true, result: { componentId: 'comp-1' } }),
        validate_project: vi.fn().mockResolvedValue({ ok: true, result: { isValid: true } }),
        isYjsEnabled: vi.fn().mockReturnValue(true)
      }
    };

    // Mock localStorage
    global.localStorage = {
      getItem: vi.fn().mockImplementation((key) => {
        if (key === 'exe-ai-provider-preset') return 'mistral-codestral';
        return null;
      }),
      setItem: vi.fn()
    };

    // Mock sessionStorage
    global.sessionStorage = {
      getItem: vi.fn().mockReturnValue(''), // Empty key triggers fallback templates
      setItem: vi.fn()
    };

    jobController = new AgentJobController(mockSidebar);
  });

  it('should initialize status as idle', () => {
    expect(jobController.status).toBe('idle');
    expect(jobController.activePlan).toBeNull();
  });

  it('should generate plan and execute autonomously in autonomous mode', async () => {
    // Search with "vulcani" to trigger template
    await jobController.processRequest('Crea un capitolo sui vulcani');
    
    expect(jobController.status).toBe('success');
    expect(mockSidebar.logSystem).toHaveBeenCalledWith(expect.stringContaining('Plan successfully drafted'));
    expect(mockSidebar.logSystem).toHaveBeenCalledWith(expect.stringContaining('Plan execution complete!'), 'success');
    expect(mockSidebar.appendResponse).toHaveBeenCalledWith('Assistant', 'assistant', expect.stringContaining('Course chapter successfully created!'));
  });

  it('should draft plan but not execute in assisted mode', async () => {
    mockSidebar.mode = 'assisted';
    
    await jobController.processRequest('Crea un capitolo sui vulcani');
    
    expect(jobController.status).toBe('idle'); // Back to idle, waiting for user approval
    expect(jobController.activePlan).not.toBeNull();
    expect(mockSidebar.logSystem).toHaveBeenCalledWith(expect.stringContaining('Plan draft ready. Type "proceed"'), 'info');
    expect(mockSidebar.appendResponse).not.toHaveBeenCalled();
  });

  it('should execute the active assisted plan when the user types proceed', async () => {
    mockSidebar.mode = 'assisted';

    await jobController.processRequest('Crea un capitolo sui vulcani');
    expect(jobController.activePlan).not.toBeNull();

    await jobController.processRequest('procedi');

    expect(jobController.status).toBe('success');
    expect(mockSidebar.toolBus.create_page).toHaveBeenCalled();
    expect(mockSidebar.appendResponse).toHaveBeenCalledWith(
      'Assistant',
      'assistant',
      expect.stringContaining('Course chapter successfully created!')
    );
  });

  it('should report validation warnings on final project check', async () => {
    mockSidebar.toolBus.validate_project.mockResolvedValue({
      ok: true,
      result: { isValid: false },
      warnings: ['Page "Quiz" has no content blocks.']
    });

    await jobController.processRequest('Crea un capitolo sui vulcani');
    
    expect(mockSidebar.appendResponse).toHaveBeenCalledWith(
      'Assistant',
      'assistant',
      expect.stringContaining('Course created with some validation warnings')
    );
  });
});
