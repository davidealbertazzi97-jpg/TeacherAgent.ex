import { describe, expect, it } from 'bun:test';
import {
    buildAnthropicUrl,
    buildGeminiUrl,
    assertProviderUrlAllowed,
    buildOpenAiCompatibleUrl,
    generateHtmlWithAi,
    stripHtmlCodeFences,
} from './ai-html-generation';

describe('ai-html-generation', () => {
    it('strips markdown html fences from provider output', () => {
        expect(stripHtmlCodeFences('```html\n<section><p>Hello</p></section>\n```')).toBe(
            '<section><p>Hello</p></section>',
        );
    });

    it('builds OpenAI-compatible chat completion URLs', () => {
        expect(buildOpenAiCompatibleUrl('https://api.example.com/v1')).toBe(
            'https://api.example.com/v1/chat/completions',
        );
        expect(buildOpenAiCompatibleUrl('https://api.example.com/v1/', 'chat/completions')).toBe(
            'https://api.example.com/v1/chat/completions',
        );
        expect(buildOpenAiCompatibleUrl('https://api.example.com/v1/chat/completions')).toBe(
            'https://api.example.com/v1/chat/completions',
        );
    });

    it('builds Anthropic and Gemini URLs', () => {
        expect(buildAnthropicUrl()).toBe('https://api.anthropic.com/v1/messages');
        expect(buildAnthropicUrl('https://proxy.example.com/anthropic/v1', 'messages')).toBe(
            'https://proxy.example.com/anthropic/v1/messages',
        );
        expect(buildAnthropicUrl('https://proxy.example.com/anthropic/v1', '')).toBe(
            'https://proxy.example.com/anthropic/v1/messages',
        );
        expect(buildGeminiUrl('gemini-2.5-flash')).toBe(
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
        );
    });

    it('rejects non-HTTPS non-local provider URLs by default', () => {
        expect(() => assertProviderUrlAllowed('http://example.com/v1')).toThrow();
    });

    it('allows localhost provider URLs only when explicitly enabled', () => {
        expect(() => assertProviderUrlAllowed('http://localhost:11434/v1')).toThrow();
        expect(() => assertProviderUrlAllowed('http://localhost:11434/v1', true)).not.toThrow();
    });

    it('calls an OpenAI-compatible provider and returns generated html', async () => {
        const calls: RequestInit[] = [];
        const fetchImpl = async (_url: string | URL | Request, init?: RequestInit) => {
            calls.push(init || {});
            return new Response(
                JSON.stringify({
                    choices: [{ message: { content: '```html\n<p>Generated</p>\n```' } }],
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } },
            );
        };

        const result = await generateHtmlWithAi(
            {
                prompt: 'Create a short activity',
                conversation: [
                    { role: 'user', content: 'Make it interactive' },
                    { role: 'assistant', content: '<button>Previous</button>' },
                ],
                provider: {
                    apiKey: 'test-key',
                    baseUrl: 'https://api.example.com/v1',
                    model: 'model-a',
                },
            },
            { fetchImpl: fetchImpl as typeof fetch },
        );

        expect(result.html).toBe('<p>Generated</p>');
        expect(calls[0].method).toBe('POST');
        expect((calls[0].headers as Record<string, string>).Authorization).toBe('Bearer test-key');
        const requestBody = JSON.parse(String(calls[0].body));
        expect(requestBody.max_tokens).toBe(8192);
        expect(requestBody.temperature).toBe(0.72);
        expect(String(calls[0].body)).toContain('Recent chat, if useful');
        expect(String(calls[0].body)).toContain('interactive educational HTML mini-games');
        expect(String(calls[0].body)).toContain('game state, scoring or progress');
    });

    it('uses the same provider to improve prompts before HTML generation', async () => {
        const calls: RequestInit[] = [];
        const fetchImpl = async (_url: string | URL | Request, init?: RequestInit) => {
            calls.push(init || {});
            return new Response(
                JSON.stringify({
                    choices: [{ message: { content: 'Premium prompt with animated theory cards and questions.' } }],
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } },
            );
        };

        const result = await generateHtmlWithAi(
            {
                task: 'improve-prompt',
                prompt: 'Create a lesson about volcanoes',
                provider: {
                    apiKey: 'test-key',
                    baseUrl: 'https://api.example.com/v1',
                    model: 'model-a',
                },
            },
            { fetchImpl: fetchImpl as typeof fetch },
        );

        const requestBody = JSON.parse(String(calls[0].body));
        expect(result.prompt).toBe('Premium prompt with animated theory cards and questions.');
        expect(requestBody.max_tokens).toBe(8192);
        expect(requestBody.temperature).toBe(0.5);
        expect(requestBody.messages[0].content).toContain('premium visual prompt engineer');
        expect(requestBody.messages[0].content).toContain('premium HTML educational mini-game');
        expect(requestBody.messages[1].content).toContain('Improve the teacher request');
    });

    it('calls Anthropic Messages API and returns generated html', async () => {
        const calls: Array<{ url: string | URL | Request; init: RequestInit }> = [];
        const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
            calls.push({ url, init: init || {} });
            return new Response(
                JSON.stringify({
                    content: [{ type: 'text', text: '```html\n<section>Claude</section>\n```' }],
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } },
            );
        };

        const result = await generateHtmlWithAi(
            {
                prompt: 'Create a short activity',
                provider: {
                    type: 'anthropic',
                    apiKey: 'test-key',
                    model: 'claude-test',
                },
            },
            { fetchImpl: fetchImpl as typeof fetch },
        );

        expect(result.html).toBe('<section>Claude</section>');
        expect(JSON.parse(String(calls[0].init.body)).max_tokens).toBe(8192);
        expect(String(calls[0].url)).toBe('https://api.anthropic.com/v1/messages');
        expect((calls[0].init.headers as Record<string, string>)['x-api-key']).toBe('test-key');
    });

    it('calls Gemini generateContent API and returns generated html', async () => {
        const calls: Array<{ url: string | URL | Request; init: RequestInit }> = [];
        const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
            calls.push({ url, init: init || {} });
            return new Response(
                JSON.stringify({
                    candidates: [{ content: { parts: [{ text: '<aside>Gemini</aside>' }] } }],
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } },
            );
        };

        const result = await generateHtmlWithAi(
            {
                prompt: 'Create a short activity',
                provider: {
                    type: 'gemini',
                    apiKey: 'test-key',
                    model: 'gemini-test',
                },
            },
            { fetchImpl: fetchImpl as typeof fetch },
        );

        expect(result.html).toBe('<aside>Gemini</aside>');
        expect(JSON.parse(String(calls[0].init.body)).generationConfig.maxOutputTokens).toBe(8192);
        expect(String(calls[0].url)).toBe(
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent',
        );
        expect((calls[0].init.headers as Record<string, string>)['x-goog-api-key']).toBe('test-key');
    });
});
