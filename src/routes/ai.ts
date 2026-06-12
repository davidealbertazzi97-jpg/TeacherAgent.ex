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

const downloadImageBody = t.Object({
    url: t.String({ minLength: 1, maxLength: 2048 }),
});

async function resolveWikiRawUrl(url: string): Promise<string> {
    if (!/wiki\/File:/i.test(url)) {
        return url;
    }
    try {
        const pageRes = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        if (!pageRes.ok) return url;

        const html = await pageRes.text();
        
        // Scan the MediaWiki HTML for the upload.wikimedia.org file link
        const mediaMatch = html.match(/class="internal"[^>]*href="([^"]+)"/i) || 
                           html.match(/<div class="fullMedia">[\s\S]*?<a[^>]+href="([^"]+)"/i) ||
                           html.match(/(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/[^"'\s>]+)/i);

        if (mediaMatch && mediaMatch[1]) {
            let directUrl = mediaMatch[1];
            if (directUrl.startsWith('//')) {
                directUrl = 'https:' + directUrl;
            }
            return directUrl;
        }
    } catch (_) {
        // Fall back to original URL on error
    }
    return url;
}

export const aiRoutes = new Elysia({ name: 'ai-routes' })
    .post(
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
    )
    .post(
        '/api/ai/download-remote-image',
        async ({ body, set }) => {
            try {
                const { url } = body;
                const resolvedUrl = await resolveWikiRawUrl(url);
                
                const response = await fetch(resolvedUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*'
                    }
                });

                if (!response.ok) {
                    set.status = 400;
                    return {
                        ok: false,
                        error: `Failed to download image from source: HTTP ${response.status} ${response.statusText}`,
                    };
                }

                const contentType = response.headers.get('content-type') || 'image/jpeg';
                if (!contentType.startsWith('image/')) {
                    set.status = 400;
                    return {
                        ok: false,
                        error: `URL did not return an image content type (got: ${contentType})`,
                    };
                }

                const arrayBuffer = await response.arrayBuffer();
                const base64 = Buffer.from(arrayBuffer).toString('base64');

                // Extract filename
                let ext = 'jpg';
                if (contentType.includes('png')) ext = 'png';
                else if (contentType.includes('gif')) ext = 'gif';
                else if (contentType.includes('svg')) ext = 'svg';
                else if (contentType.includes('webp')) ext = 'webp';

                let filename = 'downloaded_image.' + ext;
                try {
                    const urlObj = new URL(resolvedUrl);
                    const pathParts = urlObj.pathname.split('/');
                    const lastPart = pathParts[pathParts.length - 1];
                    if (lastPart && lastPart.includes('.')) {
                        filename = decodeURIComponent(lastPart);
                    }
                } catch (_) {}

                return {
                    ok: true,
                    base64,
                    mime: contentType,
                    filename,
                };
            } catch (error) {
                set.status = 400;
                return {
                    ok: false,
                    error: error instanceof Error ? error.message : 'Failed to download image.',
                };
            }
        },
        { body: downloadImageBody }
    );
