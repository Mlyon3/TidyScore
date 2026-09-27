// Settings schema: migration, sanitization, and validation of user-entered composer aliases.

import { builtInComposerDatabase } from '../data/composer-database.js';
import { DEFAULT_SETTINGS, SETTINGS_VERSION } from '../data/settings-defaults.js';
import { normalizeAliasKey, UNSAFE_OBJECT_KEYS } from './text.js';

function isPlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

export function deepClone(value) {
    if (Array.isArray(value)) return value.map(deepClone);
    if (!isPlainObject(value)) return value;
    const clone = {};
    Object.keys(value).forEach(key => {
        if (!UNSAFE_OBJECT_KEYS.has(key)) clone[key] = deepClone(value[key]);
    });
    return clone;
}

export function deepMerge(base, override) {
    if (!isPlainObject(base)) return deepClone(override);
    const merged = deepClone(base);
    if (!isPlainObject(override)) return merged;

    Object.keys(override).forEach(key => {
        if (UNSAFE_OBJECT_KEYS.has(key)) return;
        const value = override[key];
        if (Array.isArray(value)) {
            merged[key] = deepClone(value);
        } else if (isPlainObject(value)) {
            merged[key] = deepMerge(isPlainObject(merged[key]) ? merged[key] : {}, value);
        } else {
            merged[key] = value;
        }
    });
    return merged;
}

export function migrateSettings(rawSettings) {
    const source = rawSettings && typeof rawSettings === 'object' ? rawSettings : {};
    const version = Number.isInteger(source.version) ? source.version : 0;
    if (version >= 2) return source;

    return {
        version: 2,
        composer: {
            library: {
                mode: source.composer?.library?.mode || DEFAULT_SETTINGS.composer.library.mode,
                customAliases: source.composer?.library?.customAliases || {},
                blacklistedAliases: source.composer?.library?.blacklistedAliases || []
            }
        },
        normalization: {
            opusStyle: source.normalization?.opusStyle || DEFAULT_SETTINGS.normalization.opusStyle
        }
    };
}

export function sanitizeSettings(input) {
    const merged = deepMerge(DEFAULT_SETTINGS, input || {});
    merged.version = SETTINGS_VERSION;
    delete merged.composer.nameDisplayFormat;

    if (!['builtin', 'builtin_plus_custom'].includes(merged.composer?.library?.mode)) {
        merged.composer.library.mode = DEFAULT_SETTINGS.composer.library.mode;
    }

    const customAliases = {};
    const rawAliases = merged.composer?.library?.customAliases;
    if (isPlainObject(rawAliases)) {
        Object.entries(rawAliases).forEach(([key, canonical]) => {
            const normalizedKey = normalizeAliasKey(key);
            if (UNSAFE_OBJECT_KEYS.has(normalizedKey)) return;
            let cleanedCanonical = (canonical || '').toString().trim();
            const legacyParts = cleanedCanonical.split(',').map(part => part.trim()).filter(Boolean);
            if (legacyParts.length === 2) cleanedCanonical = `${legacyParts[1]} ${legacyParts[0]}`.trim();
            if (normalizedKey && cleanedCanonical) customAliases[normalizedKey] = cleanedCanonical;
        });
    }
    merged.composer.library.customAliases = customAliases;

    const rawBlacklist = merged.composer?.library?.blacklistedAliases;
    merged.composer.library.blacklistedAliases = Array.isArray(rawBlacklist)
        ? [...new Set(rawBlacklist.map(normalizeAliasKey).filter(Boolean))]
        : [];

    if (!['op', 'opus', 'preserve'].includes(merged.normalization?.opusStyle)) {
        merged.normalization.opusStyle = DEFAULT_SETTINGS.normalization.opusStyle;
    }

    return merged;
}

// Parses stored JSON into current settings. `changed` says whether it should be re-saved.
export function loadSettingsFromJson(raw) {
    if (!raw) return { settings: deepClone(DEFAULT_SETTINGS), changed: false };
    try {
        const parsed = JSON.parse(raw);
        const settings = sanitizeSettings(migrateSettings(parsed));
        return { settings, changed: JSON.stringify(parsed) !== JSON.stringify(settings) };
    } catch (_) {
        return { settings: deepClone(DEFAULT_SETTINGS), changed: false };
    }
}

// Validates alias rows ({ key, canonical }) and blacklist values typed in Settings.
export function validateComposerLibraryDraft(aliasRows, blacklistValues, builtIn = builtInComposerDatabase) {
    const customAliases = {};
    const blacklistedAliases = [];
    const blockingErrors = [];

    aliasRows.forEach(({ key: rawKey = '', canonical: rawCanonical = '' }, index) => {
        const key = normalizeAliasKey(rawKey);
        const canonical = rawCanonical.toString().trim();
        if (!rawKey.trim() && !rawCanonical.trim()) return;

        const row = `Alias row ${index + 1}`;
        if (!key) blockingErrors.push(`${row}: alias key cannot be empty.`);
        else if (UNSAFE_OBJECT_KEYS.has(key)) blockingErrors.push(`${row}: “${key}” is reserved and cannot be used as an alias key.`);
        else if (!canonical) blockingErrors.push(`${row}: canonical composer cannot be empty.`);
        else if (canonical.includes(',')) blockingErrors.push(`${row}: use First Last for one composer; commas separate multiple composers.`);
        else customAliases[key] = canonical;
    });

    blacklistValues.forEach((rawValue = '', index) => {
        if (!rawValue.trim()) return;
        const normalized = normalizeAliasKey(rawValue);
        if (!normalized) {
            blockingErrors.push(`Blacklist row ${index + 1}: alias value cannot be empty.`);
            return;
        }
        blacklistedAliases.push(normalized);
    });

    const collisionKeys = Object.keys(customAliases).filter(key => Object.hasOwn(builtIn, key));
    const warnings = collisionKeys.length
        ? [`Warning: ${collisionKeys.length} custom alias${collisionKeys.length !== 1 ? 'es' : ''} override built-in keys: ${collisionKeys.join(', ')}`]
        : [];

    return { customAliases, blacklistedAliases: [...new Set(blacklistedAliases)], blockingErrors, warnings };
}
