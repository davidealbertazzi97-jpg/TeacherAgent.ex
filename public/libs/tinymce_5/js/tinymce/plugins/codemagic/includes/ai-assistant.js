(function(root) {
    'use strict';

    var STORAGE_KEYS = {
        providerPreset: 'exe-ai-provider-preset',
        providerType: 'exe-ai-provider-type',
        baseUrl: 'exe-ai-base-url',
        model: 'exe-ai-model',
        endpointPath: 'exe-ai-endpoint-path',
        language: 'exe-ai-language',
        apiKey: 'exe-ai-api-key'
    };

    var PROVIDER_PRESETS = {
        'mistral-codestral': {
            label: 'Mistral Codestral',
            providerType: 'openai-compatible',
            baseUrl: 'https://api.mistral.ai/v1',
            endpointPath: '/chat/completions',
            model: 'codestral-latest',
            apiKeyPlaceholder: 'Mistral API key'
        },
        openai: {
            label: 'OpenAI',
            providerType: 'openai-compatible',
            baseUrl: 'https://api.openai.com/v1',
            endpointPath: '/chat/completions',
            model: 'gpt-5.2',
            apiKeyPlaceholder: 'OpenAI API key'
        },
        groq: {
            label: 'Groq',
            providerType: 'openai-compatible',
            baseUrl: 'https://api.groq.com/openai/v1',
            endpointPath: '/chat/completions',
            model: 'llama-3.3-70b-versatile',
            apiKeyPlaceholder: 'Groq API key'
        },
        'google-gemini': {
            label: 'Google Gemini',
            providerType: 'gemini',
            baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
            endpointPath: ':generateContent',
            model: 'gemini-3-pro-preview',
            apiKeyPlaceholder: 'Gemini API key'
        },
        sambanova: {
            label: 'SambaNova',
            providerType: 'openai-compatible',
            baseUrl: 'https://api.sambanova.ai/v1',
            endpointPath: '/chat/completions',
            model: 'Meta-Llama-3.3-70B-Instruct',
            apiKeyPlaceholder: 'SambaNova API key'
        },
        ollama: {
            label: 'Ollama Local',
            providerType: 'openai-compatible',
            baseUrl: 'http://localhost:11434/v1',
            endpointPath: '/chat/completions',
            model: 'llama3.1',
            apiKeyPlaceholder: 'ollama'
        },
        anthropic: {
            label: 'Anthropic Compatible',
            providerType: 'anthropic',
            baseUrl: 'https://api.anthropic.com/v1',
            endpointPath: '/messages',
            model: 'claude-sonnet-4-20250514',
            apiKeyPlaceholder: 'Anthropic API key'
        },
        'openai-compatible': {
            label: 'OpenAI Compatible Custom',
            providerType: 'openai-compatible',
            baseUrl: 'https://api.example.com/v1',
            endpointPath: '/chat/completions',
            model: '',
            apiKeyPlaceholder: 'API key'
        }
    };

    var DEFAULTS = {
        providerPreset: 'mistral-codestral',
        providerType: PROVIDER_PRESETS['mistral-codestral'].providerType,
        baseUrl: PROVIDER_PRESETS['mistral-codestral'].baseUrl,
        endpointPath: PROVIDER_PRESETS['mistral-codestral'].endpointPath,
        model: PROVIDER_PRESETS['mistral-codestral'].model,
        language: 'auto',
        apiKey: ''
    };
    var MAX_CONVERSATION_CONTENT_LENGTH = 4000;
    var MAX_CONTEXT_HTML_LENGTH = 60000;

    function trim(value) {
        return String(value || '').replace(/^\s+|\s+$/g, '');
    }

    function truncate(value, maxLength) {
        var text = trim(value);
        if (text.length <= maxLength) return text;
        return text.slice(0, maxLength) + '\n[truncated]';
    }

    function getStorageValue(storage, key, fallback) {
        try {
            return storage && storage.getItem(key) || fallback;
        } catch (error) {
            return fallback;
        }
    }

    function setStorageValue(storage, key, value) {
        try {
            if (storage) storage.setItem(key, value);
        } catch (error) {}
    }

    function readSettings(localStorageRef, sessionStorageRef) {
        var providerPreset = getStorageValue(localStorageRef, STORAGE_KEYS.providerPreset, DEFAULTS.providerPreset);
        if (!PROVIDER_PRESETS[providerPreset]) providerPreset = DEFAULTS.providerPreset;
        var defaults = getProviderDefaults(providerPreset);
        return {
            providerPreset: providerPreset,
            providerType: getStorageValue(localStorageRef, STORAGE_KEYS.providerType, defaults.providerType),
            baseUrl: getStorageValue(localStorageRef, STORAGE_KEYS.baseUrl, defaults.baseUrl),
            model: getStorageValue(localStorageRef, STORAGE_KEYS.model, defaults.model),
            endpointPath: getStorageValue(localStorageRef, STORAGE_KEYS.endpointPath, defaults.endpointPath),
            language: getStorageValue(localStorageRef, STORAGE_KEYS.language, DEFAULTS.language),
            apiKey: getStorageValue(sessionStorageRef, STORAGE_KEYS.apiKey, DEFAULTS.apiKey)
        };
    }

    function saveSettings(localStorageRef, sessionStorageRef, settings) {
        setStorageValue(localStorageRef, STORAGE_KEYS.providerPreset, settings.providerPreset);
        setStorageValue(localStorageRef, STORAGE_KEYS.providerType, settings.providerType);
        setStorageValue(localStorageRef, STORAGE_KEYS.baseUrl, settings.baseUrl);
        setStorageValue(localStorageRef, STORAGE_KEYS.model, settings.model);
        setStorageValue(localStorageRef, STORAGE_KEYS.endpointPath, settings.endpointPath);
        setStorageValue(localStorageRef, STORAGE_KEYS.language, settings.language || DEFAULTS.language);
        setStorageValue(sessionStorageRef, STORAGE_KEYS.apiKey, settings.apiKey);
    }

    function getProviderDefaults(providerPreset) {
        return PROVIDER_PRESETS[providerPreset] || PROVIDER_PRESETS[DEFAULTS.providerPreset];
    }

    function getProviderPresets() {
        return PROVIDER_PRESETS;
    }

    function getEndpoint(parentWindow) {
        var app = parentWindow && parentWindow.eXeLearning && parentWindow.eXeLearning.app;
        if (app && typeof app.composeUrl == 'function') {
            return app.composeUrl('/api/ai/generate-html');
        }

        var basePath = '';
        try {
            basePath = parentWindow && parentWindow.eXeLearning && parentWindow.eXeLearning.config && parentWindow.eXeLearning.config.basePath || '';
        } catch(error) {}
        return basePath + '/api/ai/generate-html';
    }

    function hasDesktopBridge(parentWindow) {
        return Boolean(
            parentWindow &&
            parentWindow.electronAPI &&
            typeof parentWindow.electronAPI.generateAiHtml == 'function'
        );
    }

    function generateHtml(parentWindow, payload) {
        if (hasDesktopBridge(parentWindow)) {
            return parentWindow.electronAPI.generateAiHtml(payload);
        }
        return fetch(getEndpoint(parentWindow), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(function(response) {
            return response.json().then(function(data) {
                if (!response.ok || data.error) {
                    throw new Error(data.error || 'AI generation failed.');
                }
                return data;
            });
        });
    }

    function getContextHtml(codeMirror, maxLength) {
        var selection = codeMirror.getSelection();
        if (selection) return selection;
        return codeMirror.doc.getValue().slice(0, maxLength || 20000);
    }

    function createRequestPayload(input) {
        var settings = {
            providerPreset: trim(input.providerPreset) || DEFAULTS.providerPreset,
            providerType: trim(input.providerType),
            task: trim(input.task) || 'generate-html',
            prompt: trim(input.prompt),
            baseUrl: trim(input.baseUrl),
            model: trim(input.model),
            endpointPath: trim(input.endpointPath),
            language: trim(input.language) || DEFAULTS.language,
            apiKey: trim(input.apiKey)
        };
        var defaults = getProviderDefaults(settings.providerPreset);
        if (!settings.providerType) settings.providerType = defaults.providerType;
        if (!settings.baseUrl) settings.baseUrl = defaults.baseUrl;
        if (!settings.endpointPath) settings.endpointPath = defaults.endpointPath;
        if (!settings.model) settings.model = defaults.model;
        var missing = [];
        if (!settings.prompt) missing.push('prompt');
        if (!settings.baseUrl) missing.push('baseUrl');
        if (!settings.model) missing.push('model');
        if (!settings.apiKey) missing.push('apiKey');

        return {
            missing: missing,
            settings: settings,
            payload: {
                task: settings.task,
                prompt: settings.prompt,
                language: settings.language,
                contextHtml: truncate(input.contextHtml, MAX_CONTEXT_HTML_LENGTH),
                conversation: normalizeConversation(input.conversation),
                provider: {
                    type: settings.providerType,
                    apiKey: settings.apiKey,
                    baseUrl: settings.baseUrl,
                    model: settings.model,
                    endpointPath: settings.endpointPath
                }
            }
        };
    }

    function buildFollowUpPrompt(currentPrompt, generatedHtml) {
        var html = trim(generatedHtml);
        if (!html) return trim(currentPrompt);

        var instruction = trim(currentPrompt) || 'Improve the previous generated learning object.';
        return [
            instruction,
            'Use the generated HTML currently attached as revision context for the next request. Keep what works, fix weaknesses, and modify it according to my next instruction.'
        ].join('\n\n');
    }

    function normalizeConversation(conversation) {
        if (!conversation || !conversation.length) return [];
        return conversation
            .filter(function(turn) {
                return turn && (turn.role == 'user' || turn.role == 'assistant') && trim(turn.content);
            })
            .slice(-8)
            .map(function(turn) {
                return {
                    role: turn.role,
                    content: truncate(turn.content, MAX_CONVERSATION_CONTENT_LENGTH)
                };
            });
    }

    function insertGeneratedHtml(codeMirror, html) {
        if (codeMirror.somethingSelected()) {
            codeMirror.replaceSelection(html);
        } else {
            codeMirror.replaceRange(html, codeMirror.getCursor());
        }
        codeMirror.focus();
    }

    root.CodeMagicAiAssistant = {
        createRequestPayload: createRequestPayload,
        generateHtml: generateHtml,
        getContextHtml: getContextHtml,
        getEndpoint: getEndpoint,
        hasDesktopBridge: hasDesktopBridge,
        getProviderDefaults: getProviderDefaults,
        getProviderPresets: getProviderPresets,
        insertGeneratedHtml: insertGeneratedHtml,
        buildFollowUpPrompt: buildFollowUpPrompt,
        normalizeConversation: normalizeConversation,
        readSettings: readSettings,
        saveSettings: saveSettings
    };
})(typeof window != 'undefined' ? window : globalThis);
