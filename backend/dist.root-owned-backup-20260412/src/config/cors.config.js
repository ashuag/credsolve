"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCorsOrigins = getCorsOrigins;
exports.createCorsOriginMatcher = createCorsOriginMatcher;
const app_constants_1 = require("../common/constants/app.constants");
function getCorsOrigins() {
    const configuredOrigins = (process.env.CORS_ORIGINS ?? app_constants_1.DEFAULT_CORS_ORIGINS.join(','))
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
    return Array.from(new Set(configuredOrigins));
}
function normalizeHostname(hostname) {
    return hostname.trim().replace(/^\[|\]$/g, '').toLowerCase();
}
function isPrivateNetworkHost(hostname) {
    const normalizedHostname = normalizeHostname(hostname);
    return /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})$/.test(normalizedHostname);
}
function isLocalDevelopmentHost(hostname) {
    const normalizedHostname = normalizeHostname(hostname);
    return (normalizedHostname === 'localhost' ||
        normalizedHostname === '127.0.0.1' ||
        normalizedHostname === '::1' ||
        isPrivateNetworkHost(normalizedHostname));
}
function isDevelopmentEnvironment() {
    return (process.env.NODE_ENV ?? '').toLowerCase() !== 'production';
}
function getOriginPort(url) {
    if (url.port) {
        return url.port;
    }
    if (url.protocol === 'https:') {
        return '443';
    }
    if (url.protocol === 'http:') {
        return '80';
    }
    return '';
}
function normalizeOrigin(origin) {
    try {
        const url = new URL(origin);
        return `${url.protocol}//${url.host}`;
    }
    catch {
        return origin.trim();
    }
}
function isConfiguredOrigin(origin, allowedOrigins) {
    const normalizedOrigin = normalizeOrigin(origin);
    return allowedOrigins.some((allowedOrigin) => normalizeOrigin(allowedOrigin) === normalizedOrigin);
}
function getAllowedDevPorts(allowedOrigins) {
    const ports = allowedOrigins
        .map((origin) => {
        try {
            const url = new URL(origin);
            return isLocalDevelopmentHost(url.hostname) ? getOriginPort(url) : null;
        }
        catch {
            return null;
        }
    })
        .filter((port) => Boolean(port));
    return new Set(ports);
}
function isAllowedDevOrigin(origin, allowedOrigins) {
    try {
        const url = new URL(origin);
        if (!['http:', 'https:'].includes(url.protocol)) {
            return false;
        }
        if (!isLocalDevelopmentHost(url.hostname)) {
            return false;
        }
        if (isDevelopmentEnvironment()) {
            return true;
        }
        const allowedDevPorts = getAllowedDevPorts(allowedOrigins);
        return allowedDevPorts.has(getOriginPort(url));
    }
    catch {
        return false;
    }
}
function createCorsOriginMatcher() {
    const allowedOrigins = getCorsOrigins();
    return (origin, callback) => {
        if (!origin) {
            callback(null, true);
            return;
        }
        if (isConfiguredOrigin(origin, allowedOrigins) || isAllowedDevOrigin(origin, allowedOrigins)) {
            callback(null, true);
            return;
        }
        callback(new Error(`CORS blocked for origin: ${origin}`), false);
    };
}
