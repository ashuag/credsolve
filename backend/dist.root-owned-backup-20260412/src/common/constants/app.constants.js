"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CORS_ORIGINS = exports.LOOKUP_CACHE_TTL_SECONDS = exports.OTP_TYPE_CACHE_TTL_SECONDS = exports.DEFAULT_PORT = exports.SWAGGER_PATH = exports.API_PREFIX = void 0;
exports.API_PREFIX = 'api';
exports.SWAGGER_PATH = `${exports.API_PREFIX}/docs`;
exports.DEFAULT_PORT = 4000;
exports.OTP_TYPE_CACHE_TTL_SECONDS = 300;
exports.LOOKUP_CACHE_TTL_SECONDS = 3600;
exports.DEFAULT_CORS_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3010',
    'http://localhost:3011',
    'http://localhost:4000',
    'http://localhost:4001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:3010',
    'http://127.0.0.1:3011',
    'http://127.0.0.1:4000',
    'http://127.0.0.1:4001'
];
