import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentToolBus } from './AgentToolBus.js';

describe('AgentToolBus', () => {
  let mockProjectManager;
  let toolBus;

  beforeEach(() => {
    // Mock global Yjs functions
    window.Y = {
      encodeStateAsUpdate: vi.fn().mockReturnValue('mock-binary-update'),
      applyUpdate: vi.fn()
    };

    // Standard mock structure for Yjs-based ProjectManager
    mockProjectManager = {
      isYjsEnabled: vi.fn().mockReturnValue(true),
      getYjsBridge: vi.fn().mockReturnValue({
        getDocumentManager: vi.fn().mockReturnValue({
          yDoc: {},
          getNavigation: vi.fn().mockReturnValue({
            length: 2,
            get: vi.fn().mockImplementation((index) => {
              const mockBlocks = {
                length: 1,
                forEach: vi.fn().mockImplementation((cb) => {
                  const mockBlockMap = {
                    get: vi.fn().mockImplementation((key) => {
                      if (key === 'id' || key === 'blockId') return 'block-1';
                      if (key === 'blockName') return 'Teoria';
                      if (key === 'order') return 0;
                      if (key === 'components' || key === 'idevices') {
                        return {
                          forEach: vi.fn().mockImplementation((compCb) => {
                            const mockCompMap = {
                              get: vi.fn().mockImplementation((compKey) => {
                                if (compKey === 'id' || compKey === 'ideviceId') return 'comp-1';
                                if (compKey === 'type' || compKey === 'ideviceType') return 'FreeTextIdevice';
                                if (compKey === 'order') return 0;
                                if (compKey === 'htmlView') return '<p>Vulcani</p>';
                                return null;
                              })
                            };
                            compCb(mockCompMap);
                          })
                        };
                      }
                      return null;
                    })
                  };
                  cb(mockBlockMap);
                })
              };

              const mockPageMap = {
                get: vi.fn().mockImplementation((key) => {
                  if (key === 'id' || key === 'pageId') return `page-${index}`;
                  if (key === 'title' || key === 'pageName') return `Page ${index}`;
                  if (key === 'parentId') return null;
                  if (key === 'order') return index;
                  if (key === 'blocks') return mockBlocks;
                  return null;
                })
              };
              return mockPageMap;
            })
          })
        })
      }),
      addPageViaYjs: vi.fn().mockImplementation((title, parentId) => ({
        id: 'new-page-id',
        get: (key) => (key === 'id' ? 'new-page-id' : null)
      })),
      renamePageViaYjs: vi.fn().mockReturnValue(true),
      movePageViaYjs: vi.fn().mockReturnValue(true),
      addBlockViaYjs: vi.fn().mockReturnValue('new-block-id'),
      addComponentViaYjs: vi.fn().mockReturnValue('new-comp-id'),
      updateComponentHtmlViaYjs: vi.fn(),
      deletePageViaYjs: vi.fn().mockReturnValue(true),
      deleteComponentViaYjs: vi.fn().mockReturnValue(true),
      exportToElpxViaYjs: vi.fn().mockResolvedValue({ saved: true, filePath: '/path/test.elpx' })
    };

    toolBus = new AgentToolBus(mockProjectManager);
    window.eXeLearning = {
      app: {
        idevices: {
          list: {
            installed: {
              text: { id: 'text', title: 'Text', category: 'Information and presentation', description: 'Text component' },
              trivial: { id: 'trivial', title: 'Trivial', category: 'Games', description: 'Quiz game' }
            }
          }
        }
      }
    };
  });

  describe('Validation & Safety', () => {
    it('should fail if Yjs mode is not enabled', async () => {
      mockProjectManager.isYjsEnabled.mockReturnValue(false);
      const res = await toolBus.create_page({ title: 'Vulcani' });
      expect(res.ok).toBe(false);
      expect(res.error).toContain('Yjs collaboration mode is not enabled');
    });

    it('should validate inputs using schemas', async () => {
      const res = await toolBus.create_page({ title: '' }); // Empty title should trigger schema error
      expect(res.ok).toBe(false);
      expect(res.error).toContain('title must be a non-empty string');
    });
  });

  describe('Read Tools', () => {
    it('should read project structure correctly', async () => {
      const res = await toolBus.read_project_structure();
      expect(res.ok).toBe(true);
      expect(res.result).toHaveLength(2);
      expect(res.result[0].id).toBe('page-0');
      expect(res.result[0].blocks[0].name).toBe('Teoria');
      expect(res.result[0].blocks[0].components[0].htmlView).toBe('<p>Vulcani</p>');
    });

    it('should read available idevices list', async () => {
      const res = await toolBus.read_available_idevices();
      expect(res.ok).toBe(true);
      expect(res.result).toEqual([
        { name: 'text', title: 'Text', category: 'Information and presentation', description: 'Text component' },
        { name: 'trivial', title: 'Trivial', category: 'Games', description: 'Quiz game' }
      ]);
    });

    it('should not invent fallback iDevices when the real list is unavailable', async () => {
      window.eXeLearning.app.idevices.list.installed = {};
      const res = await toolBus.read_available_idevices();
      expect(res.ok).toBe(true);
      expect(res.result).toEqual([]);
    });
  });

  describe('Write Tools', () => {
    it('should create page successfully', async () => {
      const res = await toolBus.create_page({ title: 'Nuova Pagina', parentId: 'page-0' });
      expect(res.ok).toBe(true);
      expect(res.result.pageId).toBe('new-page-id');
      expect(mockProjectManager.addPageViaYjs).toHaveBeenCalledWith('Nuova Pagina', 'page-0');
    });

    it('should rename page successfully', async () => {
      const res = await toolBus.rename_page({ pageId: 'page-0', title: 'Nuovo Nome' });
      expect(res.ok).toBe(true);
      expect(mockProjectManager.renamePageViaYjs).toHaveBeenCalledWith('page-0', 'Nuovo Nome');
    });

    it('should move page successfully', async () => {
      const res = await toolBus.move_page({ pageId: 'page-1', parentId: 'page-0', index: 1 });
      expect(res.ok).toBe(true);
      expect(mockProjectManager.movePageViaYjs).toHaveBeenCalledWith('page-1', 'page-0', 1);
    });

    it('should create block successfully', async () => {
      const res = await toolBus.create_block({ pageId: 'page-0', title: 'Nuovo Blocco' });
      expect(res.ok).toBe(true);
      expect(res.result.blockId).toBe('new-block-id');
      expect(mockProjectManager.addBlockViaYjs).toHaveBeenCalledWith('page-0', 'Nuovo Blocco');
    });

    it('should create HTML component successfully', async () => {
      const res = await toolBus.create_html_idevice({
        pageId: 'page-0',
        blockId: 'block-0',
        title: 'Introduzione',
        html: '<p>Teoria</p>'
      });
      expect(res.ok).toBe(true);
      expect(res.result.componentId).toBe('new-comp-id');
      expect(mockProjectManager.addComponentViaYjs).toHaveBeenCalledWith('page-0', 'block-0', 'FreeTextIdevice', {
        htmlView: '<p>Teoria</p>'
      });
      expect(mockProjectManager.updateComponentHtmlViaYjs).toHaveBeenCalledWith('page-0', 'block-0', 'new-comp-id', '<p>Teoria</p>');
    });

    it('should support an explicit component type when creating an HTML component', async () => {
      const res = await toolBus.create_html_idevice({
        pageId: 'page-0',
        blockId: 'block-0',
        title: 'Introduzione',
        ideviceType: 'text',
        html: '<p>Teoria</p>'
      });
      expect(res.ok).toBe(true);
      expect(res.result.type).toBe('text');
      expect(mockProjectManager.addComponentViaYjs).toHaveBeenCalledWith('page-0', 'block-0', 'text', {
        htmlView: '<p>Teoria</p>'
      });
    });

    it('should update iDevice HTML successfully', async () => {
      const res = await toolBus.update_idevice_html({
        pageId: 'page-0',
        blockId: 'block-0',
        componentId: 'comp-1',
        html: '<h2>Aggiornato</h2>'
      });
      expect(res.ok).toBe(true);
      expect(mockProjectManager.updateComponentHtmlViaYjs).toHaveBeenCalledWith('page-0', 'block-0', 'comp-1', '<h2>Aggiornato</h2>');
    });

    it('should delete page successfully', async () => {
      const res = await toolBus.delete_page({ pageId: 'page-1' });
      expect(res.ok).toBe(true);
      expect(mockProjectManager.deletePageViaYjs).toHaveBeenCalledWith('page-1');
    });

    it('should delete idevice successfully', async () => {
      const res = await toolBus.delete_idevice({ componentId: 'comp-1' });
      expect(res.ok).toBe(true);
      expect(mockProjectManager.deleteComponentViaYjs).toHaveBeenCalledWith('comp-1');
    });
  });

  describe('Validation & Export Tools', () => {
    it('should validate project integrity and list warnings', async () => {
      const res = await toolBus.validate_project();
      expect(res.ok).toBe(true);
      expect(res.result.isValid).toBe(true);
      expect(res.warnings).toHaveLength(0);
    });

    it('should export project successfully', async () => {
      const res = await toolBus.export_project_elpx();
      expect(res.ok).toBe(true);
      expect(res.result.saved).toBe(true);
      expect(mockProjectManager.exportToElpxViaYjs).toHaveBeenCalled();
    });
  });
});
