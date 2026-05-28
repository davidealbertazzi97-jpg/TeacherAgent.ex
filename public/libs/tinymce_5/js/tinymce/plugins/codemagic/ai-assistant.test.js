const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadHelper() {
    const source = fs.readFileSync(path.join(__dirname, 'includes/ai-assistant.js'), 'utf8');
    const context = { window: {} };
    vm.runInNewContext(source, context);
    return context.window.CodeMagicAiAssistant;
}

function makeStorage(initial = {}) {
    const data = { ...initial };
    return {
        data,
        getItem(key) {
            return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
        },
        setItem(key, value) {
            data[key] = value;
        },
    };
}

describe('codemagic AI assistant helper', () => {
    it('reads and saves provider settings with local and session storage split', () => {
        const helper = loadHelper();
        const localStorage = makeStorage();
        const sessionStorage = makeStorage();

        expect(helper.readSettings(localStorage, sessionStorage)).toEqual({
            providerPreset: 'mistral-codestral',
            providerType: 'openai-compatible',
            baseUrl: 'https://api.mistral.ai/v1',
            endpointPath: '/chat/completions',
            model: 'codestral-latest',
            apiKey: '',
        });

        helper.saveSettings(localStorage, sessionStorage, {
            providerPreset: 'mistral-codestral',
            providerType: 'openai-compatible',
            baseUrl: 'https://api.mistral.ai/v1',
            model: 'codestral-latest',
            endpointPath: '/chat/completions',
            apiKey: 'secret-for-test',
        });

        expect(localStorage.data['exe-ai-provider-preset']).toBe('mistral-codestral');
        expect(localStorage.data['exe-ai-provider-type']).toBe('openai-compatible');
        expect(localStorage.data['exe-ai-base-url']).toBe('https://api.mistral.ai/v1');
        expect(localStorage.data['exe-ai-model']).toBe('codestral-latest');
        expect(localStorage.data['exe-ai-endpoint-path']).toBe('/chat/completions');
        expect(sessionStorage.data['exe-ai-api-key']).toBe('secret-for-test');
    });

    it('exposes editable provider presets with Mistral first by default', () => {
        const helper = loadHelper();
        const presets = helper.getProviderPresets();

        expect(Object.keys(presets)[0]).toBe('mistral-codestral');
        expect(helper.getProviderDefaults('mistral-codestral')).toEqual({
            label: 'Mistral Codestral',
            providerType: 'openai-compatible',
            baseUrl: 'https://api.mistral.ai/v1',
            endpointPath: '/chat/completions',
            model: 'codestral-latest',
            apiKeyPlaceholder: 'Mistral API key',
        });
        expect(helper.getProviderDefaults('openai')).toEqual({
            label: 'OpenAI',
            providerType: 'openai-compatible',
            baseUrl: 'https://api.openai.com/v1',
            endpointPath: '/chat/completions',
            model: 'gpt-5.2',
            apiKeyPlaceholder: 'OpenAI API key',
        });
        expect(helper.getProviderDefaults('anthropic')).toEqual({
            label: 'Anthropic Compatible',
            providerType: 'anthropic',
            baseUrl: 'https://api.anthropic.com/v1',
            endpointPath: '/messages',
            model: 'claude-sonnet-4-20250514',
            apiKeyPlaceholder: 'Anthropic API key',
        });
        expect(helper.getProviderDefaults('google-gemini')).toEqual({
            label: 'Google Gemini',
            providerType: 'gemini',
            baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
            endpointPath: ':generateContent',
            model: 'gemini-3-pro-preview',
            apiKeyPlaceholder: 'Gemini API key',
        });
        expect(helper.getProviderDefaults('ollama')).toEqual({
            label: 'Ollama Local',
            providerType: 'openai-compatible',
            baseUrl: 'http://localhost:11434/v1',
            endpointPath: '/chat/completions',
            model: 'llama3.1',
            apiKeyPlaceholder: 'ollama',
        });
        expect(helper.getProviderDefaults('sambanova').model).toBe('Meta-Llama-3.3-70B-Instruct');
        expect(helper.getProviderDefaults('groq').model).toBe('llama-3.3-70b-versatile');
    });

    it('falls back to the Mistral preset when stored preset data is invalid', () => {
        const helper = loadHelper();
        const localStorage = makeStorage({ 'exe-ai-provider-preset': 'deleted-provider' });

        expect(helper.readSettings(localStorage, makeStorage()).providerPreset).toBe('mistral-codestral');
        expect(helper.readSettings(localStorage, makeStorage()).model).toBe('codestral-latest');
    });

    it('uses composeUrl for the backend endpoint when the host app provides it', () => {
        const helper = loadHelper();
        const endpoint = helper.getEndpoint({
            eXeLearning: {
                app: {
                    composeUrl(pathname) {
                        return `/base${pathname}`;
                    },
                },
            },
        });

        expect(endpoint).toBe('/base/api/ai/generate-html');
    });

    it('uses the Electron bridge for desktop AI generation when available', async () => {
        const helper = loadHelper();
        const payload = { prompt: 'make a quiz' };
        const parentWindow = {
            electronAPI: {
                generateAiHtml(input) {
                    return Promise.resolve({ html: `<p>${input.prompt}</p>` });
                },
            },
        };

        expect(helper.hasDesktopBridge(parentWindow)).toBe(true);
        await expect(helper.generateHtml(parentWindow, payload)).resolves.toEqual({ html: '<p>make a quiz</p>' });
    });

    it('builds a trimmed request payload and reports missing settings', () => {
        const helper = loadHelper();
        const result = helper.createRequestPayload({
            providerPreset: 'openai',
            providerType: 'openai-compatible',
            prompt: '  make a timeline  ',
            contextHtml: '<p>Existing</p>',
            conversation: [{ role: 'user', content: '  make it visual  ' }],
            baseUrl: ' https://api.openai.com/v1 ',
            model: ' gpt-4.1-mini ',
            endpointPath: ' /chat/completions ',
            apiKey: ' test-key ',
        });

        expect(result.missing).toEqual([]);
        expect(result.payload).toEqual({
            task: 'generate-html',
            prompt: 'make a timeline',
            contextHtml: '<p>Existing</p>',
            conversation: [{ role: 'user', content: 'make it visual' }],
            provider: {
                type: 'openai-compatible',
                apiKey: 'test-key',
                baseUrl: 'https://api.openai.com/v1',
                model: 'gpt-4.1-mini',
                endpointPath: '/chat/completions',
            },
        });

        expect(helper.createRequestPayload({ prompt: '', baseUrl: '', model: '', apiKey: '' }).missing).toEqual([
            'prompt',
            'apiKey',
        ]);
    });

    it('truncates oversized context HTML before sending backend payloads', () => {
        const helper = loadHelper();
        const result = helper.createRequestPayload({
            prompt: 'revise it',
            contextHtml: '<section>' + 'x'.repeat(70000) + '</section>',
            apiKey: 'test-key',
        });

        expect(result.payload.contextHtml.length).toBeLessThan(60150);
        expect(result.payload.contextHtml).toContain('[truncated]');
    });

    it('fills missing provider URL and endpoint from the selected provider defaults', () => {
        const helper = loadHelper();
        const result = helper.createRequestPayload({
            providerPreset: 'google-gemini',
            prompt: 'make a card sort',
            conversation: [{ role: 'bad', content: 'ignored' }],
            apiKey: 'test-key',
        });

        expect(result.missing).toEqual([]);
        expect(result.payload.provider).toEqual({
            type: 'gemini',
            apiKey: 'test-key',
            baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
            model: 'gemini-3-pro-preview',
            endpointPath: ':generateContent',
        });
        expect(result.payload.task).toBe('generate-html');
        expect(result.payload.conversation).toEqual([]);
    });

    it('includes prompt-enhancement task requests in backend payloads', () => {
        const helper = loadHelper();
        const result = helper.createRequestPayload({
            task: 'improve-prompt',
            prompt: 'make a matching game',
            apiKey: 'test-key',
        });

        expect(result.missing).toEqual([]);
        expect(result.payload.task).toBe('improve-prompt');
        expect(result.settings.task).toBe('improve-prompt');
    });

    it('normalizes chat turns for backend context', () => {
        const helper = loadHelper();

        expect(
            helper.normalizeConversation([
                { role: 'user', content: '  first  ' },
                { role: 'assistant', content: '' },
                { role: 'other', content: 'ignored' },
                { role: 'assistant', content: '  second  ' },
            ]),
        ).toEqual([
            { role: 'user', content: 'first' },
            { role: 'assistant', content: 'second' },
        ]);
    });

    it('truncates oversized chat turns before sending backend context', () => {
        const helper = loadHelper();
        const turns = helper.normalizeConversation([{ role: 'assistant', content: 'x'.repeat(5000) }]);

        expect(turns).toHaveLength(1);
        expect(turns[0].content.length).toBeLessThan(4050);
        expect(turns[0].content).toContain('[truncated]');
    });

    it('uses the current selection as context before falling back to source HTML', () => {
        const helper = loadHelper();
        const selected = {
            getSelection: () => '<section>Selected</section>',
            doc: { getValue: () => '<main>Ignored</main>' },
        };
        const unselected = {
            getSelection: () => '',
            doc: { getValue: () => '1234567890' },
        };

        expect(helper.getContextHtml(selected)).toBe('<section>Selected</section>');
        expect(helper.getContextHtml(unselected, 4)).toBe('1234');
    });

    it('inserts generated HTML into the selection or cursor', () => {
        const helper = loadHelper();
        const calls = [];
        const selected = {
            somethingSelected: () => true,
            replaceSelection: (html) => calls.push(['selection', html]),
            focus: () => calls.push(['focus']),
        };
        const cursor = {
            somethingSelected: () => false,
            replaceRange: (html, position) => calls.push(['range', html, position]),
            getCursor: () => ({ line: 3, ch: 2 }),
            focus: () => calls.push(['focus']),
        };

        helper.insertGeneratedHtml(selected, '<p>A</p>');
        helper.insertGeneratedHtml(cursor, '<p>B</p>');

        expect(calls).toEqual([
            ['selection', '<p>A</p>'],
            ['focus'],
            ['range', '<p>B</p>', { line: 3, ch: 2 }],
            ['focus'],
        ]);
    });

    it('builds a compact follow-up prompt while keeping HTML out of the prompt text', () => {
        const helper = loadHelper();
        const prompt = helper.buildFollowUpPrompt('Make it more visual', ' <section>Draft</section> ');

        expect(prompt).toContain('Make it more visual');
        expect(prompt).toContain('generated HTML currently attached as revision context');
        expect(prompt).not.toContain('```html');
        expect(prompt).not.toContain('<section>Draft</section>');
        expect(helper.buildFollowUpPrompt('Keep only this', '')).toBe('Keep only this');
    });
});
