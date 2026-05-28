import { Elysia, t } from 'elysia';
import { generateHtmlWithAi, type AiHtmlGenerationRequest } from '../services/ai-html-generation';

const aiHtmlBody = t.Object({
    task: t.Optional(t.Union([t.Literal('generate-html'), t.Literal('improve-prompt')])),
    prompt: t.String({ minLength: 1, maxLength: 64000 }),
    contextHtml: t.Optional(t.String({ maxLength: 64000 })),
    conversation: t.Optional(
        t.Array(
            t.Object({
                role: t.Union([t.Literal('user'), t.Literal('assistant')]),
                content: t.String({ minLength: 1, maxLength: 12000 }),
            }),
            { maxItems: 8 },
        ),
    ),
    provider: t.Object({
        type: t.Optional(t.Union([t.Literal('openai-compatible'), t.Literal('anthropic'), t.Literal('gemini')])),
        apiKey: t.String({ minLength: 1, maxLength: 4096 }),
        baseUrl: t.Optional(t.String({ minLength: 1, maxLength: 2048 })),
        model: t.String({ minLength: 1, maxLength: 256 }),
        endpointPath: t.Optional(t.String({ minLength: 1, maxLength: 512 })),
    }),
});

export const aiRoutes = new Elysia({ name: 'ai-routes' }).post(
    '/api/ai/generate-html',
    async ({ body, set }) => {
        try {
            return await generateHtmlWithAi(body as AiHtmlGenerationRequest, {
                allowLocalProviderUrls: process.env.AI_ALLOW_LOCAL_PROVIDER_URLS === 'true',
            });
        } catch (error) {
            set.status = 400;
            return {
                error: error instanceof Error ? error.message : 'AI HTML generation failed.',
            };
        }
    },
    { body: aiHtmlBody },
);
