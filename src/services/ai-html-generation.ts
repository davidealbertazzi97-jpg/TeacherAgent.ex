export type AiProviderType = 'openai-compatible' | 'anthropic' | 'gemini';

export interface AiProviderConfig {
    apiKey: string;
    baseUrl?: string;
    model: string;
    endpointPath?: string;
    type?: AiProviderType;
}

export interface AiConversationTurn {
    role: 'user' | 'assistant';
    content: string;
}

export interface AiHtmlGenerationRequest {
    prompt: string;
    contextHtml?: string;
    conversation?: AiConversationTurn[];
    provider: AiProviderConfig;
}

export interface AiHtmlGenerationResult {
    html: string;
}

export interface AiHtmlGenerationDeps {
    fetchImpl?: typeof fetch;
    allowLocalProviderUrls?: boolean;
}

interface OpenAiCompatibleResponse {
    choices?: Array<{
        message?: {
            content?: string;
        };
        text?: string;
    }>;
    error?: {
        message?: string;
    };
}

interface AnthropicResponse {
    content?: Array<{
        type?: string;
        text?: string;
    }>;
    error?: {
        message?: string;
    };
}

interface GeminiResponse {
    candidates?: Array<{
        content?: {
            parts?: Array<{
                text?: string;
            }>;
        };
    }>;
    error?: {
        message?: string;
    };
}

const DEFAULT_ENDPOINT_PATH = '/chat/completions';
const DEFAULT_OPENAI_COMPATIBLE_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1';
const DEFAULT_GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

const SYSTEM_PROMPT =
    'You generate accessible HTML fragments for eXeLearning learning objects. ' +
    'Return only the HTML fragment, without Markdown fences or explanations.';

export function stripHtmlCodeFences(value: string): string {
    const trimmed = value.trim();
    const fenceMatch = trimmed.match(/^```(?:html)?\s*([\s\S]*?)\s*```$/i);
    return (fenceMatch ? fenceMatch[1] : trimmed).trim();
}

export function buildOpenAiCompatibleUrl(baseUrl: string, endpointPath = DEFAULT_ENDPOINT_PATH): string {
    const parsedBase = new URL(baseUrl);
    const normalizedEndpoint = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
    const basePath = parsedBase.pathname.replace(/\/+$/, '');
    parsedBase.pathname = basePath.endsWith(normalizedEndpoint) ? basePath : `${basePath}${normalizedEndpoint}`;
    parsedBase.search = '';
    parsedBase.hash = '';
    return parsedBase.toString();
}

export function buildAnthropicUrl(baseUrl = DEFAULT_ANTHROPIC_BASE_URL, endpointPath = '/messages'): string {
    const parsedBase = new URL(baseUrl);
    const normalizedEndpoint = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
    const basePath = parsedBase.pathname.replace(/\/+$/, '');
    parsedBase.pathname = basePath.endsWith(normalizedEndpoint) ? basePath : `${basePath}${normalizedEndpoint}`;
    parsedBase.search = '';
    parsedBase.hash = '';
    return parsedBase.toString();
}

export function buildGeminiUrl(
    model: string,
    baseUrl = DEFAULT_GEMINI_BASE_URL,
    endpointPath = ':generateContent',
): string {
    const parsedBase = new URL(baseUrl);
    const encodedModel = encodeURIComponent(model).replace(/%2F/g, '/');
    const normalizedEndpoint = endpointPath.startsWith(':') ? endpointPath : `:${endpointPath.replace(/^:+/, '')}`;
    const basePath = parsedBase.pathname.replace(/\/+$/, '');
    const modelPath = `/models/${encodedModel}${normalizedEndpoint}`;
    parsedBase.pathname = basePath.endsWith(modelPath) ? basePath : `${basePath}${modelPath}`;
    parsedBase.search = '';
    parsedBase.hash = '';
    return parsedBase.toString();
}

export function assertProviderUrlAllowed(baseUrl: string, allowLocalProviderUrls = false): void {
    const url = new URL(baseUrl);
    const isLocal = LOCAL_HOSTS.has(url.hostname);
    const isHttps = url.protocol === 'https:';
    const isAllowedLocal = allowLocalProviderUrls && isLocal && ['http:', 'https:'].includes(url.protocol);

    if (!isHttps && !isAllowedLocal) {
        throw new Error('AI provider baseUrl must use HTTPS unless local provider URLs are explicitly enabled.');
    }
}

export function validateAiHtmlGenerationRequest(request: AiHtmlGenerationRequest): void {
    if (!request.prompt?.trim()) {
        throw new Error('Prompt is required.');
    }
    if (!request.provider?.apiKey?.trim()) {
        throw new Error('Provider API key is required.');
    }
    if (!request.provider?.model?.trim()) {
        throw new Error('Provider model is required.');
    }
}

function getProviderType(provider: AiProviderConfig): AiProviderType {
    return provider.type || 'openai-compatible';
}

function getProviderBaseUrl(provider: AiProviderConfig): string {
    if (provider.baseUrl?.trim()) return provider.baseUrl.trim();
    if (getProviderType(provider) === 'anthropic') return DEFAULT_ANTHROPIC_BASE_URL;
    if (getProviderType(provider) === 'gemini') return DEFAULT_GEMINI_BASE_URL;
    return DEFAULT_OPENAI_COMPATIBLE_BASE_URL;
}

function buildUserPrompt(request: AiHtmlGenerationRequest): string {
    return [
        request.conversation?.length
            ? `Recent chat, if useful:\n${request.conversation
                  .slice(-8)
                  .map(turn => `${turn.role === 'user' ? 'Teacher' : 'Assistant'}: ${turn.content.trim()}`)
                  .join('\n\n')}`
            : null,
        request.contextHtml?.trim() ? `Current source HTML, if useful:\n${request.contextHtml.trim()}` : null,
        `Teacher request:\n${request.prompt.trim()}`,
    ]
        .filter(Boolean)
        .join('\n\n');
}

async function generateWithOpenAiCompatible(
    request: AiHtmlGenerationRequest,
    fetchImpl: typeof fetch,
    baseUrl: string,
): Promise<string> {
    const url = buildOpenAiCompatibleUrl(baseUrl, request.provider.endpointPath);
    const response = await fetchImpl(url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${request.provider.apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: request.provider.model,
            messages: [
                {
                    role: 'system',
                    content: SYSTEM_PROMPT,
                },
                {
                    role: 'user',
                    content: buildUserPrompt(request),
                },
            ],
            temperature: 0.4,
        }),
    });

    const data = (await response.json().catch(() => ({}))) as OpenAiCompatibleResponse;
    if (!response.ok) {
        throw new Error(data.error?.message || `AI provider returned HTTP ${response.status}.`);
    }

    return data.choices?.[0]?.message?.content || data.choices?.[0]?.text || '';
}

async function generateWithAnthropic(
    request: AiHtmlGenerationRequest,
    fetchImpl: typeof fetch,
    baseUrl: string,
): Promise<string> {
    const url = buildAnthropicUrl(baseUrl, request.provider.endpointPath);
    const response = await fetchImpl(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01',
            'x-api-key': request.provider.apiKey,
        },
        body: JSON.stringify({
            model: request.provider.model,
            max_tokens: 4096,
            system: SYSTEM_PROMPT,
            messages: [
                {
                    role: 'user',
                    content: buildUserPrompt(request),
                },
            ],
            temperature: 0.4,
        }),
    });

    const data = (await response.json().catch(() => ({}))) as AnthropicResponse;
    if (!response.ok) {
        throw new Error(data.error?.message || `AI provider returned HTTP ${response.status}.`);
    }

    return data.content?.find(part => part.type === 'text' && part.text?.trim())?.text || '';
}

async function generateWithGemini(
    request: AiHtmlGenerationRequest,
    fetchImpl: typeof fetch,
    baseUrl: string,
): Promise<string> {
    const url = buildGeminiUrl(request.provider.model, baseUrl, request.provider.endpointPath);
    const response = await fetchImpl(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': request.provider.apiKey,
        },
        body: JSON.stringify({
            systemInstruction: {
                parts: [{ text: SYSTEM_PROMPT }],
            },
            contents: [
                {
                    role: 'user',
                    parts: [{ text: buildUserPrompt(request) }],
                },
            ],
            generationConfig: {
                temperature: 0.4,
            },
        }),
    });

    const data = (await response.json().catch(() => ({}))) as GeminiResponse;
    if (!response.ok) {
        throw new Error(data.error?.message || `AI provider returned HTTP ${response.status}.`);
    }

    return data.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('\n') || '';
}

export async function generateHtmlWithAi(
    request: AiHtmlGenerationRequest,
    deps: AiHtmlGenerationDeps = {},
): Promise<AiHtmlGenerationResult> {
    validateAiHtmlGenerationRequest(request);
    const providerType = getProviderType(request.provider);
    const baseUrl = getProviderBaseUrl(request.provider);
    assertProviderUrlAllowed(baseUrl, deps.allowLocalProviderUrls);

    const fetchImpl = deps.fetchImpl || fetch;
    let content = '';

    if (providerType === 'openai-compatible') {
        content = await generateWithOpenAiCompatible(request, fetchImpl, baseUrl);
    } else if (providerType === 'anthropic') {
        content = await generateWithAnthropic(request, fetchImpl, baseUrl);
    } else if (providerType === 'gemini') {
        content = await generateWithGemini(request, fetchImpl, baseUrl);
    } else {
        throw new Error('Unsupported AI provider type.');
    }

    if (!content?.trim()) {
        throw new Error('AI provider returned an empty response.');
    }

    return { html: stripHtmlCodeFences(content) };
}
