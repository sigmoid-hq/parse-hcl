/* Simple logger used inside the parser. */
export const logger = {
    debug: (...args: unknown[]): void => {
        if (process.env.TF_PARSER_DEBUG) {
            console.debug('[parser:debug]', ...args);
        }
    },
    info: (...args: unknown[]): void => {
        console.info('[parser:info]', ...args);
    },
    warn: (...args: unknown[]): void => {
        console.warn('[parser:warn]', ...args);
    }
};
