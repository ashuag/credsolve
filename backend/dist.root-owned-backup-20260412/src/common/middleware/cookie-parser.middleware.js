"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cookieParserMiddleware = cookieParserMiddleware;
function decodeCookieValue(value) {
    try {
        return decodeURIComponent(value);
    }
    catch {
        return value;
    }
}
function parseCookies(header) {
    const cookieHeader = Array.isArray(header) ? header.join(';') : header;
    if (!cookieHeader) {
        return {};
    }
    return cookieHeader
        .split(';')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .reduce((cookies, entry) => {
        const [name, ...valueParts] = entry.split('=');
        if (!name) {
            return cookies;
        }
        cookies[name] = decodeCookieValue(valueParts.join('='));
        return cookies;
    }, {});
}
function cookieParserMiddleware(request, _response, next) {
    request.cookies = parseCookies(request.headers.cookie);
    next();
}
