/**
 * AgentToolSchemas
 * Pure validation functions for all eXeLearning AI Agent tools.
 * Ensures the agent inputs are well-formed and safe.
 */
export const AgentToolSchemas = {
  create_page(args) {
    if (!args || typeof args !== 'object') return 'Arguments must be an object';
    if (typeof args.title !== 'string' || args.title.trim() === '') return 'title must be a non-empty string';
    if (args.parentId !== undefined && args.parentId !== null && typeof args.parentId !== 'string') {
      return 'parentId must be a string or null';
    }
    return null; // Valid
  },

  rename_page(args) {
    if (!args || typeof args !== 'object') return 'Arguments must be an object';
    if (typeof args.pageId !== 'string' || args.pageId.trim() === '') return 'pageId must be a non-empty string';
    if (typeof args.title !== 'string' || args.title.trim() === '') return 'title must be a non-empty string';
    return null;
  },

  move_page(args) {
    if (!args || typeof args !== 'object') return 'Arguments must be an object';
    if (typeof args.pageId !== 'string' || args.pageId.trim() === '') return 'pageId must be a non-empty string';
    if (args.parentId !== undefined && args.parentId !== null && typeof args.parentId !== 'string') {
      return 'parentId must be a string or null';
    }
    if (args.index !== undefined && args.index !== null && typeof args.index !== 'number') {
      return 'index must be a number';
    }
    return null;
  },

  create_block(args) {
    if (!args || typeof args !== 'object') return 'Arguments must be an object';
    if (typeof args.pageId !== 'string' || args.pageId.trim() === '') return 'pageId must be a non-empty string';
    if (typeof args.title !== 'string' || args.title.trim() === '') return 'title must be a non-empty string';
    return null;
  },

  create_html_idevice(args) {
    if (!args || typeof args !== 'object') return 'Arguments must be an object';
    if (typeof args.pageId !== 'string' || args.pageId.trim() === '') return 'pageId must be a non-empty string';
    if (typeof args.blockId !== 'string' || args.blockId.trim() === '') return 'blockId must be a non-empty string';
    if (typeof args.title !== 'string' || args.title.trim() === '') return 'title must be a non-empty string';
    if (typeof args.html !== 'string') return 'html must be a string';
    if (args.html.length > 250000) return 'html exceeds the 250000 character limit';
    if (args.ideviceType !== undefined && typeof args.ideviceType !== 'string') return 'ideviceType must be a string';
    return null;
  },

  update_idevice_html(args) {
    if (!args || typeof args !== 'object') return 'Arguments must be an object';
    if (typeof args.pageId !== 'string' || args.pageId.trim() === '') return 'pageId must be a non-empty string';
    if (typeof args.blockId !== 'string' || args.blockId.trim() === '') return 'blockId must be a non-empty string';
    if (typeof args.componentId !== 'string' || args.componentId.trim() === '') return 'componentId must be a non-empty string';
    if (typeof args.html !== 'string') return 'html must be a string';
    if (args.html.length > 250000) return 'html exceeds the 250000 character limit';
    return null;
  },

  delete_page(args) {
    if (!args || typeof args !== 'object') return 'Arguments must be an object';
    if (typeof args.pageId !== 'string' || args.pageId.trim() === '') return 'pageId must be a non-empty string';
    return null;
  },

  delete_idevice(args) {
    if (!args || typeof args !== 'object') return 'Arguments must be an object';
    if (typeof args.componentId !== 'string' || args.componentId.trim() === '') return 'componentId must be a non-empty string';
    return null;
  },

  update_idevice_properties(args) {
    if (!args || typeof args !== 'object') return 'Arguments must be an object';
    if (typeof args.componentId !== 'string' || args.componentId.trim() === '') return 'componentId must be a non-empty string';
    if (!args.properties || typeof args.properties !== 'object') return 'properties must be an object';
    return null;
  }
};
