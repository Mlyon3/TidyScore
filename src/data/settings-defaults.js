export const SETTINGS_VERSION = 2;
export const DEFAULT_SETTINGS = {
    version: SETTINGS_VERSION,
    composer: {
        library: {
            mode: 'builtin_plus_custom',
            customAliases: {},
            blacklistedAliases: []
        }
    },
    normalization: {
        opusStyle: 'preserve'
    }
};
