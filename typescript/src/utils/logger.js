"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
/* Simple logger used inside the parser. */
exports.logger = {
    debug: (...args) => {
        if (process.env.TF_PARSER_DEBUG) {
            // eslint-disable-next-line no-console
            console.debug('[parser:debug]', ...args);
        }
    },
    info: (...args) => {
        // eslint-disable-next-line no-console
        console.info('[parser:info]', ...args);
    },
    warn: (...args) => {
        // eslint-disable-next-line no-console
        console.warn('[parser:warn]', ...args);
    }
};
