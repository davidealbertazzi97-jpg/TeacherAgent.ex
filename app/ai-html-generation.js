'use strict';

const DEFAULT_ENDPOINT_PATH = '/chat/completions';
const DEFAULT_OPENAI_COMPATIBLE_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1';
const DEFAULT_GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

const HTML_SYSTEM_PROMPT =
    'You generate accessible HTML fragments for eXeLearning learning objects. ' +
    'Return only the HTML fragment, without Markdown fences or explanations.';
const PROMPT_ENGINEERING_SYSTEM_PROMPT =
    'You are a senior instructional designer and premium visual prompt engineer for eXeLearning. ' +
    'Rewrite the teacher request into a concise, production-ready prompt for an HTML learning object. ' +
    'Always enrich it with a premium visual direction: expressive layout, atmospheric background, cohesive color palette, optional illustrative image placeholders, meaningful animations, theory blocks, dialogue or scenario moments, checks for understanding, and final questions. ' +
    'Require accessible, responsive, self-contained HTML/CSS/JS suitable for eXeLearning, without external dependencies. ' +
    'Return only the improved prompt text, not HTML, not Markdown fences, and no explanations.';

function stripHtmlCodeFences(value) {
    const trimmed = String(value || '').trim();
    const fenceMatch = trimmed.match(/^```(?:html)?\s*([\s\S]*?)\s*```$/i);
    return (fenceMatch ? fenceMatch[1] : trimmed).trim();
}

function buildProviderUrl(baseUrl, endpointPath = DEFAULT_ENDPOINT_PATH) {
    const parsedBase = new URL(baseUrl);
    const normalizedEndpoint = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
    const basePath = parsedBase.pathname.replace(/\/+$/, '');
    parsedBase.pathname = basePath.endsWith(normalizedEndpoint) ? basePath : `${basePath}${normalizedEndpoint}`;
    parsedBase.search = '';
    parsedBase.hash = '';
    return parsedBase.toString();
}

function buildGeminiUrl(model, baseUrl = DEFAULT_GEMINI_BASE_URL, endpointPath = ':generateContent') {
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

function assertProviderUrlAllowed(baseUrl, allowLocalProviderUrls = false) {
    const url = new URL(baseUrl);
    const isLocal = LOCAL_HOSTS.has(url.hostname);
    const isHttps = url.protocol === 'https:';
    const isAllowedLocal = allowLocalProviderUrls && isLocal && ['http:', 'https:'].includes(url.protocol);

    if (!isHttps && !isAllowedLocal) {
        throw new Error('AI provider baseUrl must use HTTPS unless local provider URLs are explicitly enabled.');
    }
}

function validateRequest(request) {
    if (!request || typeof request !== 'object') throw new Error('AI request is required.');
    if (!request.prompt || !String(request.prompt).trim()) throw new Error('Prompt is required.');
    if (!request.provider || typeof request.provider !== 'object') throw new Error('Provider settings are required.');
    if (!request.provider.apiKey || !String(request.provider.apiKey).trim()) {
        throw new Error('Provider API key is required.');
    }
    if (!request.provider.model || !String(request.provider.model).trim()) {
        throw new Error('Provider model is required.');
    }
}

function getProviderType(provider) {
    return provider.type || 'openai-compatible';
}

function getTask(request) {
    return request.task === 'improve-prompt' ? 'improve-prompt' : 'generate-html';
}

function getSystemPrompt(request) {
    return getTask(request) === 'improve-prompt' ? PROMPT_ENGINEERING_SYSTEM_PROMPT : HTML_SYSTEM_PROMPT;
}

function getProviderBaseUrl(provider) {
    if (provider.baseUrl && String(provider.baseUrl).trim()) return String(provider.baseUrl).trim();
    if (getProviderType(provider) === 'anthropic') return DEFAULT_ANTHROPIC_BASE_URL;
    if (getProviderType(provider) === 'gemini') return DEFAULT_GEMINI_BASE_URL;
    return DEFAULT_OPENAI_COMPATIBLE_BASE_URL;
}

function buildUserPrompt(request) {
    const conversation = Array.isArray(request.conversation) ? request.conversation : [];
    return [
        getTask(request) === 'improve-prompt'
            ? 'Improve the teacher request before HTML generation. Preserve the educational intent, but make the prompt substantially more specific, premium, visual, interactive, and implementation-ready.'
            : null,
        conversation.length
            ? `Recent chat, if useful:\n${conversation
                  .slice(-8)
                  .map(turn => `${turn.role === 'user' ? 'Teacher' : 'Assistant'}: ${String(turn.content || '').trim()}`)
                  .join('\n\n')}`
            : null,
        request.contextHtml && String(request.contextHtml).trim()
            ? `Current source HTML, if useful:\n${String(request.contextHtml).trim()}`
            : null,
        `Teacher request:\n${String(request.prompt).trim()}`,
    ]
        .filter(Boolean)
        .join('\n\n');
}

async function generateWithOpenAiCompatible(request, fetchImpl, baseUrl) {
    const response = await fetchImpl(buildProviderUrl(baseUrl, request.provider.endpointPath), {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${request.provider.apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: request.provider.model,
            messages: [
                { role: 'system', content: getSystemPrompt(request) },
                { role: 'user', content: buildUserPrompt(request) },
            ],
            temperature: 0.4,
        }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || `AI provider returned HTTP ${response.status}.`);
    return data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || '';
}

async function generateWithAnthropic(request, fetchImpl, baseUrl) {
    const response = await fetchImpl(buildProviderUrl(baseUrl, request.provider.endpointPath || '/messages'), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01',
            'x-api-key': request.provider.apiKey,
        },
        body: JSON.stringify({
            model: request.provider.model,
            max_tokens: 4096,
            system: getSystemPrompt(request),
            messages: [{ role: 'user', content: buildUserPrompt(request) }],
            temperature: 0.4,
        }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || `AI provider returned HTTP ${response.status}.`);
    return data?.content?.find(part => part.type === 'text' && part.text && part.text.trim())?.text || '';
}

async function generateWithGemini(request, fetchImpl, baseUrl) {
    const response = await fetchImpl(buildGeminiUrl(request.provider.model, baseUrl, request.provider.endpointPath), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': request.provider.apiKey,
        },
        body: JSON.stringify({
            systemInstruction: {
                parts: [{ text: getSystemPrompt(request) }],
            },
            contents: [{ role: 'user', parts: [{ text: buildUserPrompt(request) }] }],
            generationConfig: {
                temperature: 0.4,
            },
        }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || `AI provider returned HTTP ${response.status}.`);
    return data?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('\n') || '';
}

async function generateHtmlWithAi(request, deps = {}) {
    validateRequest(request);
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

    if (!content || !content.trim()) throw new Error('AI provider returned an empty response.');
    if (getTask(request) === 'improve-prompt') {
        return { prompt: stripHtmlCodeFences(content) };
    }

    return { html: stripHtmlCodeFences(content) };
}

module.exports = {
    assertProviderUrlAllowed,
    buildGeminiUrl,
    buildProviderUrl,
    generateHtmlWithAi,
    stripHtmlCodeFences,
};
