"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const app_constants_1 = require("./common/constants/app.constants");
const cors_config_1 = require("./config/cors.config");
const swagger_1 = require("./config/swagger");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.setGlobalPrefix(app_constants_1.API_PREFIX);
    app.enableCors({
        origin: (0, cors_config_1.createCorsOriginMatcher)(),
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true
    });
    app.useGlobalPipes(new common_1.ValidationPipe({ whitelist: true, transform: true }));
    (0, swagger_1.setupSwagger)(app);
    await app.listen(Number(process.env.PORT ?? app_constants_1.DEFAULT_PORT));
}
bootstrap();
