/* Simple logger used inside the parser. */
export const logger = {
    debug: (...args: unknown[]): void => {
        if (process.env.TF_PARSER_DEBUG) {
            // eslint-disable-next-line no-console
            console.debug('[parser:debug]', ...args);
        }
    },
    info: (...args: unknown[]): void => {
        // eslint-disable-next-line no-console
        console.info('[parser:info]', ...args);
    },
    warn: (...args: unknown[]): void => {
        // eslint-disable-next-line no-console
        console.warn('[parser:warn]', ...args);
    }
};
