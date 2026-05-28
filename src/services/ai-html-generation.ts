export type AiProviderType = 'openai-compatible' | 'anthropic' | 'gemini';
export type AiGenerationTask = 'generate-html' | 'improve-prompt';

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
    task?: AiGenerationTask;
    prompt: string;
    language?: string;
    contextHtml?: string;
    conversation?: AiConversationTurn[];
    provider: AiProviderConfig;
}

export interface AiHtmlGenerationResult {
    html?: string;
    prompt?: string;
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
const DEFAULT_MAX_OUTPUT_TOKENS = 8192;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

const HTML_SYSTEM_PROMPT =
    'You generate production-quality interactive educational HTML mini-games for eXeLearning, not short toy snippets. ' +
    'The default output must be a substantial self-contained HTML fragment with semantic markup, embedded CSS, and embedded JavaScript. ' +
    'Include a premium visual direction with atmospheric backgrounds, cohesive color palette, illustrated UI elements or safe placeholders, polished typography, responsive layout, meaningful animations, and micro-interactions. ' +
    'Build real interaction: game state, scoring or progress, feedback, restart/next-step controls, branching or multiple-choice dialogue when relevant, memory/matching or challenge mechanics when useful, theory blocks, checkpoints, and final questions. ' +
    'Keep it accessible with keyboard-friendly controls, readable contrast, ARIA/status feedback where useful, and no external dependencies. ' +
    'Return only the HTML fragment, without Markdown fences or explanations.';
const PROMPT_ENGINEERING_SYSTEM_PROMPT =
    'You are a senior instructional designer and premium visual prompt engineer for eXeLearning. ' +
    'Rewrite the teacher request into a detailed, production-ready prompt for a premium HTML educational mini-game, not a basic card or worksheet. ' +
    'Always specify visual art direction, atmospheric background, cohesive palette, layout system, animation style, UI states, responsive behavior, and optional image placeholders. ' +
    'Always specify concrete learning mechanics: story/scenario, multiple-choice dialogue, game loop, scoring/progress, memory or matching/challenge mechanics when appropriate, theory blocks, feedback states, checkpoints, and final reflection questions. ' +
    'Require accessible, responsive, self-contained HTML/CSS/JS suitable for eXeLearning, without external dependencies, with enough implementation detail to produce rich code. ' +
    'Return only the improved prompt text, not HTML, not Markdown fences, and no explanations.';

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
    const effectiveEndpoint = endpointPath.trim() || '/messages';
    const normalizedEndpoint = effectiveEndpoint.startsWith('/') ? effectiveEndpoint : `/${effectiveEndpoint}`;
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

function getTask(request: AiHtmlGenerationRequest): AiGenerationTask {
    return request.task === 'improve-prompt' ? 'improve-prompt' : 'generate-html';
}

function getSystemPrompt(request: AiHtmlGenerationRequest): string {
    return getTask(request) === 'improve-prompt' ? PROMPT_ENGINEERING_SYSTEM_PROMPT : HTML_SYSTEM_PROMPT;
}

function getTemperature(request: AiHtmlGenerationRequest): number {
    return getTask(request) === 'improve-prompt' ? 0.5 : 0.72;
}

function getProviderBaseUrl(provider: AiProviderConfig): string {
    if (provider.baseUrl?.trim()) return provider.baseUrl.trim();
    if (getProviderType(provider) === 'anthropic') return DEFAULT_ANTHROPIC_BASE_URL;
    if (getProviderType(provider) === 'gemini') return DEFAULT_GEMINI_BASE_URL;
    return DEFAULT_OPENAI_COMPATIBLE_BASE_URL;
}

function buildUserPrompt(request: AiHtmlGenerationRequest): string {
    const task = getTask(request);
    const language = request.language?.trim();
    return [
        language && language !== 'auto'
            ? `Language requirement: write the improved prompt, all learner-facing text, labels, feedback, dialogues, theory blocks, and questions in language code "${language}".`
            : 'Language requirement: preserve the teacher language detected from the request and existing HTML. Do not switch language unless the teacher asks.',
        task === 'improve-prompt'
            ? 'Improve the teacher request before HTML generation. Preserve the educational intent, but make the prompt substantially more specific, premium, visual, interactive, and implementation-ready.'
            : null,
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
                    content: getSystemPrompt(request),
                },
                {
                    role: 'user',
                    content: buildUserPrompt(request),
                },
            ],
            temperature: getTemperature(request),
            max_tokens: DEFAULT_MAX_OUTPUT_TOKENS,
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
            max_tokens: DEFAULT_MAX_OUTPUT_TOKENS,
            system: getSystemPrompt(request),
            messages: [
                {
                    role: 'user',
                    content: buildUserPrompt(request),
                },
            ],
            temperature: getTemperature(request),
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
                parts: [{ text: getSystemPrompt(request) }],
            },
            contents: [
                {
                    role: 'user',
                    parts: [{ text: buildUserPrompt(request) }],
                },
            ],
            generationConfig: {
                temperature: getTemperature(request),
                maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS,
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

    if (getTask(request) === 'improve-prompt') {
        return { prompt: stripHtmlCodeFences(content) };
    }

    return { html: stripHtmlCodeFences(content) };
}
