// Pure text helpers shared by the domain layer. No DOM, no app state.

export const UNSAFE_OBJECT_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

export function stripDiacritics(value) {
    return value.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function normalizeAliasKey(value) {
    return (value || '').toString().toLowerCase().trim();
}

export function escapeRegex(value = '') {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
