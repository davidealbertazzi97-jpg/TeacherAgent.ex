import { AgentToolSchemas } from './AgentToolSchemas.js';

export class AgentToolBus {
  /**
   * @param {Object} projectManager - The eXeLearning ProjectManager instance
   */
  constructor(projectManager) {
    this.projectManager = projectManager || window.eXeLearning?.app?.project;
    this.localSnapshot = null;
  }

  /**
   * Standardize the tool execution response format.
   */
  response(ok, result = null, error = null, warnings = []) {
    return { ok, result, error, warnings };
  }

  /**
   * Safety check that Yjs collaborative mode is active.
   */
  checkYjs() {
    if (!this.projectManager) {
      return 'ProjectManager not initialized';
    }
    if (typeof this.projectManager.isYjsEnabled !== 'function' || !this.projectManager.isYjsEnabled()) {
      return 'Yjs collaboration mode is not enabled';
    }
    return null;
  }

  /**
   * Retrieve the complete lesson outline (pages, blocks, iDevices)
   */
  async read_project_structure() {
    const err = this.checkYjs();
    if (err) return this.response(false, null, err);

    try {
      const bridge = this.projectManager.getYjsBridge();
      const documentManager = bridge.getDocumentManager();
      const navigation = documentManager.getNavigation();
      
      const structure = [];
      for (let i = 0; i < navigation.length; i++) {
        const pageMap = navigation.get(i);
        if (!pageMap) continue;
        
        const pageData = {
          id: pageMap.get('id') || pageMap.get('pageId'),
          title: pageMap.get('title') || pageMap.get('pageName') || 'Untitled Page',
          parentId: pageMap.get('parentId'),
          order: pageMap.get('order'),
          blocks: []
        };
        
        const blocks = pageMap.get('blocks');
        if (blocks && typeof blocks.forEach === 'function') {
          blocks.forEach(blockMap => {
            const blockData = {
              id: blockMap.get('id') || blockMap.get('blockId'),
              name: blockMap.get('blockName') || 'Block',
              order: blockMap.get('order'),
              components: []
            };
            
            const components = blockMap.get('components') || blockMap.get('idevices');
            if (components && typeof components.forEach === 'function') {
              components.forEach(compMap => {
                blockData.components.push({
                  id: compMap.get('id') || compMap.get('ideviceId'),
                  type: compMap.get('type') || compMap.get('ideviceType'),
                  order: compMap.get('order'),
                  htmlView: compMap.get('htmlView') || ''
                });
              });
            }
            pageData.blocks.push(blockData);
          });
        }
        structure.push(pageData);
      }
      return this.response(true, structure);
    } catch (e) {
      return this.response(false, null, e.message);
    }
  }

  /**
   * Discover and list all installed iDevices and their categories.
   */
  async read_available_idevices() {
    try {
      const app = window.eXeLearning?.app;
      const idevicesList = app?.idevices?.list?.installed || {};
      const list = [];
      
      for (const [key, value] of Object.entries(idevicesList)) {
        list.push({
          name: value.id || key,
          title: value.title || key,
          category: value.category || 'Others',
          description: value.description || ''
        });
      }

      return this.response(true, list);
    } catch (e) {
      return this.response(false, null, e.message);
    }
  }

  /**
   * Create a new page.
   */
  async create_page(args) {
    const schemaErr = AgentToolSchemas.create_page(args);
    if (schemaErr) return this.response(false, null, schemaErr);

    const err = this.checkYjs();
    if (err) return this.response(false, null, err);

    try {
      const page = this.projectManager.addPageViaYjs(args.title, args.parentId || null);
      if (!page) {
        return this.response(false, null, 'Failed to create page via Yjs');
      }
      const pageId = page.get ? page.get('id') : page.id;
      return this.response(true, { pageId, title: args.title });
    } catch (e) {
      return this.response(false, null, e.message);
    }
  }

  /**
   * Rename an existing page.
   */
  async rename_page(args) {
    const schemaErr = AgentToolSchemas.rename_page(args);
    if (schemaErr) return this.response(false, null, schemaErr);

    const err = this.checkYjs();
    if (err) return this.response(false, null, err);

    try {
      const success = this.projectManager.renamePageViaYjs(args.pageId, args.title);
      if (!success) {
        return this.response(false, null, `Page with ID ${args.pageId} not found or rename failed`);
      }
      return this.response(true, { pageId: args.pageId, title: args.title });
    } catch (e) {
      return this.response(false, null, e.message);
    }
  }

  /**
   * Move an existing page in the outline tree.
   */
  async move_page(args) {
    const schemaErr = AgentToolSchemas.move_page(args);
    if (schemaErr) return this.response(false, null, schemaErr);

    const err = this.checkYjs();
    if (err) return this.response(false, null, err);

    try {
      const success = this.projectManager.movePageViaYjs(args.pageId, args.parentId || null, args.index !== undefined ? args.index : null);
      if (!success) {
        return this.response(false, null, `Failed to move page ${args.pageId}`);
      }
      return this.response(true, { pageId: args.pageId, parentId: args.parentId || null });
    } catch (e) {
      return this.response(false, null, e.message);
    }
  }

  /**
   * Create a block in a page.
   */
  async create_block(args) {
    const schemaErr = AgentToolSchemas.create_block(args);
    if (schemaErr) return this.response(false, null, schemaErr);

    const err = this.checkYjs();
    if (err) return this.response(false, null, err);

    try {
      const blockId = this.projectManager.addBlockViaYjs(args.pageId, args.title);
      if (!blockId) {
        return this.response(false, null, `Failed to create block on page ${args.pageId}`);
      }
      return this.response(true, { blockId, title: args.title, pageId: args.pageId });
    } catch (e) {
      return this.response(false, null, e.message);
    }
  }

  /**
   * Create a rich HTML iDevice within a block.
   */
  async create_html_idevice(args) {
    const schemaErr = AgentToolSchemas.create_html_idevice(args);
    if (schemaErr) return this.response(false, null, schemaErr);

    const err = this.checkYjs();
    if (err) return this.response(false, null, err);

    try {
      const componentType = args.ideviceType || 'FreeTextIdevice';
      const componentId = this.projectManager.addComponentViaYjs(args.pageId, args.blockId, componentType, {
        htmlView: args.html
      });
      if (!componentId) {
        return this.response(false, null, 'Failed to create iDevice component');
      }
      
      // Update HTML to ensure properly synchronized
      if (args.html) {
        this.projectManager.updateComponentHtmlViaYjs(args.pageId, args.blockId, componentId, args.html);
      }
      
      return this.response(true, { componentId, title: args.title, blockId: args.blockId, type: componentType });
    } catch (e) {
      return this.response(false, null, e.message);
    }
  }

  /**
   * Update HTML content of an existing iDevice.
   */
  async update_idevice_html(args) {
    const schemaErr = AgentToolSchemas.update_idevice_html(args);
    if (schemaErr) return this.response(false, null, schemaErr);

    const err = this.checkYjs();
    if (err) return this.response(false, null, err);

    try {
      this.projectManager.updateComponentHtmlViaYjs(args.pageId, args.blockId, args.componentId, args.html);
      return this.response(true, { componentId: args.componentId });
    } catch (e) {
      return this.response(false, null, e.message);
    }
  }

  /**
   * Delete a page.
   */
  async delete_page(args) {
    const schemaErr = AgentToolSchemas.delete_page(args);
    if (schemaErr) return this.response(false, null, schemaErr);

    const err = this.checkYjs();
    if (err) return this.response(false, null, err);

    try {
      const success = this.projectManager.deletePageViaYjs(args.pageId);
      if (!success) {
        return this.response(false, null, `Page ${args.pageId} not found or deletion failed`);
      }
      return this.response(true, { pageId: args.pageId });
    } catch (e) {
      return this.response(false, null, e.message);
    }
  }

  /**
   * Delete a component (iDevice).
   */
  async delete_idevice(args) {
    const schemaErr = AgentToolSchemas.delete_idevice(args);
    if (schemaErr) return this.response(false, null, schemaErr);

    const err = this.checkYjs();
    if (err) return this.response(false, null, err);

    try {
      const success = this.projectManager.deleteComponentViaYjs(args.componentId);
      if (!success) {
        return this.response(false, null, `Component ${args.componentId} not found or deletion failed`);
      }
      return this.response(true, { componentId: args.componentId });
    } catch (e) {
      return this.response(false, null, e.message);
    }
  }

  /**
   * Validate project integrity.
   */
  async validate_project() {
    const err = this.checkYjs();
    if (err) return this.response(false, null, err);

    try {
      const bridge = this.projectManager.getYjsBridge();
      const documentManager = bridge.getDocumentManager();
      const navigation = documentManager.getNavigation();
      
      const warnings = [];
      if (navigation.length === 0) {
        warnings.push('The course is completely empty. There are no pages.');
      } else {
        // Iterate pages
        for (let i = 0; i < navigation.length; i++) {
          const pageMap = navigation.get(i);
          const pageTitle = pageMap.get('title') || pageMap.get('pageName');
          const blocks = pageMap.get('blocks');
          
          if (!blocks || blocks.length === 0) {
            warnings.push(`Page "${pageTitle}" has no content blocks.`);
          } else {
            blocks.forEach(blockMap => {
              const components = blockMap.get('components') || blockMap.get('idevices');
              if (!components || components.length === 0) {
                warnings.push(`Block "${blockMap.get('blockName')}" on page "${pageTitle}" has no iDevices.`);
              }
            });
          }
        }
      }
      
      return this.response(true, { isValid: warnings.length === 0 }, null, warnings);
    } catch (e) {
      return this.response(false, null, e.message);
    }
  }

  /**
   * Export the project to .elpx format.
   */
  async export_project_elpx() {
    const err = this.checkYjs();
    if (err) return this.response(false, null, err);

    try {
      const result = await this.projectManager.exportToElpxViaYjs();
      return this.response(true, result);
    } catch (e) {
      return this.response(false, null, e.message);
    }
  }
}
