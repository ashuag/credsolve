"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const app_constants_1 = require("./common/constants/app.constants");
const api_exception_filter_1 = require("./common/filters/api-exception.filter");
const cookie_parser_middleware_1 = require("./common/middleware/cookie-parser.middleware");
const cors_config_1 = require("./config/cors.config");
const swagger_1 = require("./config/swagger");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        logger: ['log', 'error', 'warn', 'debug', 'verbose'],
    });
    app.setGlobalPrefix(app_constants_1.API_PREFIX, {
        exclude: [
            { path: 'auth/google/login', method: common_1.RequestMethod.GET },
            { path: 'auth/google/callback', method: common_1.RequestMethod.GET },
        ],
    });
    app.enableCors({
        origin: (0, cors_config_1.createCorsOriginMatcher)(),
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
    });
    app.use(cookie_parser_middleware_1.cookieParserMiddleware);
    app.useGlobalPipes(new common_1.ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new api_exception_filter_1.ApiExceptionFilter());
    (0, swagger_1.setupSwagger)(app);
    const port = Number(process.env.PORT ?? app_constants_1.DEFAULT_PORT);
    await app.listen(port);
    common_1.Logger.log(`🚀 Backend running on http://localhost:${port}`, 'Bootstrap');
    common_1.Logger.log(`📖 Swagger at http://localhost:${port}/${app_constants_1.API_PREFIX}/docs`, 'Bootstrap');
}
bootstrap();
