import { describe, expect, it } from 'bun:test';
import { aiRoutes } from './ai';

describe('AI Routes', () => {
    it('validates missing provider values', async () => {
        const response = await aiRoutes.handle(
            new Request('http://localhost/api/ai/generate-html', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: 'Create an activity',
                    provider: {
                        apiKey: '',
                        baseUrl: 'https://api.example.com/v1',
                        model: 'model-a',
                    },
                }),
            }),
        );

        expect(response.status).toBe(422);
    });
});
