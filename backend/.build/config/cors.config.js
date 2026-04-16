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
function isPrivateNetworkHost(hostname) {
    return /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})$/.test(hostname);
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
function isAllowedDevOrigin(origin) {
    try {
        const url = new URL(origin);
        const allowedPorts = new Set(['3000', '3001', '3010', '3011', '4173', '5173']);
        if (!['http:', 'https:'].includes(url.protocol)) {
            return false;
        }
        if (!allowedPorts.has(url.port)) {
            return false;
        }
        return url.hostname === 'localhost' || url.hostname === '127.0.0.1' || isPrivateNetworkHost(url.hostname);
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
        if (isConfiguredOrigin(origin, allowedOrigins) || isAllowedDevOrigin(origin)) {
            callback(null, true);
            return;
        }
        callback(new Error(`CORS blocked for origin: ${origin}`), false);
    };
}
