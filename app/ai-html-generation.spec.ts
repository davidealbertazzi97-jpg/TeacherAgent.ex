import { describe, expect, it } from 'bun:test';

const {
    buildGeminiUrl,
    buildProviderUrl,
    generateHtmlWithAi,
    stripHtmlCodeFences,
} = require('./ai-html-generation');

describe('Electron AI HTML generation bridge', () => {
    it('builds provider URLs used by the desktop process', () => {
        expect(buildProviderUrl('https://api.example.com/v1')).toBe('https://api.example.com/v1/chat/completions');
        expect(buildGeminiUrl('gemini-2.5-flash')).toBe(
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
        );
    });

    it('strips HTML code fences before returning content to the renderer', () => {
        expect(stripHtmlCodeFences('```html\n<p>Desktop</p>\n```')).toBe('<p>Desktop</p>');
    });

    it('generates HTML through an OpenAI-compatible desktop request', async () => {
        const calls: RequestInit[] = [];
        const fetchImpl = async (_url: string | URL | Request, init?: RequestInit) => {
            calls.push(init || {});
            return new Response(JSON.stringify({ choices: [{ message: { content: '<p>Generated</p>' } }] }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        };

        const result = await generateHtmlWithAi(
            {
                prompt: 'Create a card',
                provider: {
                    apiKey: 'test-key',
                    baseUrl: 'https://api.example.com/v1',
                    model: 'model-a',
                },
            },
            { fetchImpl },
        );

        expect(result).toEqual({ html: '<p>Generated</p>' });
        expect((calls[0].headers as Record<string, string>).Authorization).toBe('Bearer test-key');
        expect(String(calls[0].body)).toContain('interactive educational HTML mini-games');
    });

    it('can improve prompts through the desktop bridge before HTML generation', async () => {
        const calls: RequestInit[] = [];
        const fetchImpl = async (_url: string | URL | Request, init?: RequestInit) => {
            calls.push(init || {});
            return new Response(
                JSON.stringify({ choices: [{ message: { content: 'Premium prompt for an animated activity.' } }] }),
                {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                },
            );
        };

        const result = await generateHtmlWithAi(
            {
                task: 'improve-prompt',
                prompt: 'Create a card',
                provider: {
                    apiKey: 'test-key',
                    baseUrl: 'https://api.example.com/v1',
                    model: 'model-a',
                },
            },
            { fetchImpl },
        );

        expect(result).toEqual({ prompt: 'Premium prompt for an animated activity.' });
        expect(String(calls[0].body)).toContain('premium visual prompt engineer');
        expect(String(calls[0].body)).toContain('premium HTML educational mini-game');
    });
});
