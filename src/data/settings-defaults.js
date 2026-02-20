export const SETTINGS_VERSION = 1;
export const DEFAULT_SETTINGS = {
    version: SETTINGS_VERSION,
    composer: {
        nameDisplayFormat: 'last_first',
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
