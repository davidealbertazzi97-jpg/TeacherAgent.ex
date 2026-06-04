import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IdeviceRegistry } from './IdeviceRegistry.js';

describe('IdeviceRegistry', () => {
  let mockToolBus;
  let registry;

  beforeEach(() => {
    mockToolBus = {
      read_available_idevices: vi.fn().mockResolvedValue({
        ok: true,
        result: [
          { name: 'text', title: 'Text', category: 'Information and presentation' },
          { name: 'quick-questions-multiple-choice', title: 'Multiple Choice', category: 'Interactive activities' },
          { name: 'slide', title: 'Slide', category: 'Others' },
          { name: 'unknown-idevice', title: 'Unknown', category: 'Others' }
        ]
      })
    };
    registry = new IdeviceRegistry(mockToolBus);
  });

  it('should enrich and classify all installed iDevices', async () => {
    const list = await registry.getRegisteredIdevices();
    
    expect(list).toHaveLength(4);
    
    // text should be html-safe
    const textIdevice = list.find(d => d.name === 'text');
    expect(textIdevice.agentSupport).toBe('html-safe');
    expect(textIdevice.createTool).toBe('create_html_idevice');

    // quick-questions-multiple-choice should be schema-supported
    const quizIdevice = list.find(d => d.name === 'quick-questions-multiple-choice');
    expect(quizIdevice.agentSupport).toBe('schema-supported');
    expect(quizIdevice.createTool).toBe('create_quiz_idevice');

    // slide should be manual-only
    const slideIdevice = list.find(d => d.name === 'slide');
    expect(slideIdevice.agentSupport).toBe('manual-only');
    expect(slideIdevice.createTool).toBeNull();

    // Unknown iDevices should fall back to schema-supported via create_idevice
    const unknownIdevice = list.find(d => d.name === 'unknown-idevice');
    expect(unknownIdevice.agentSupport).toBe('schema-supported');
    expect(unknownIdevice.createTool).toBe('create_idevice');
  });

  it('should check if a specific iDevice is safe for direct HTML generation', async () => {
    expect(await registry.isHtmlSafe('FreeTextIdevice')).toBe(true);
    expect(await registry.isHtmlSafe('text')).toBe(true);
    expect(await registry.isHtmlSafe('markdown-text')).toBe(true);
    expect(await registry.isHtmlSafe('Text')).toBe(true);
    expect(await registry.isHtmlSafe('MultichoiceIdevice')).toBe(false);
    expect(await registry.isHtmlSafe('slide')).toBe(false);
    expect(await registry.isHtmlSafe('NonExistent')).toBe(false);
  });

  it('should check if an iDevice is supported by specialized schemas', async () => {
    expect(await registry.isSchemaSupported('MultichoiceIdevice')).toBe(true);
    expect(await registry.isSchemaSupported('TrueFalseIdevice')).toBe(true);
    expect(await registry.isSchemaSupported('quick-questions-multiple-choice')).toBe(true);
    expect(await registry.isSchemaSupported('trueorfalse')).toBe(true);
    expect(await registry.isSchemaSupported('FreeTextIdevice')).toBe(false);
    expect(await registry.isSchemaSupported('slide')).toBe(false);
    expect(await registry.isSchemaSupported('NonExistent')).toBe(false);
  });
});
