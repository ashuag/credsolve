"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSwagger = setupSwagger;
const swagger_1 = require("@nestjs/swagger");
const app_constants_1 = require("../common/constants/app.constants");
function setupSwagger(app) {
    const swaggerConfig = new swagger_1.DocumentBuilder()
        .setTitle('MoneyCash API')
        .setDescription('Development API documentation for the MoneyCash backend.')
        .setVersion('0.1.0')
        .addBearerAuth()
        .build();
    const swaggerDocument = swagger_1.SwaggerModule.createDocument(app, swaggerConfig);
    swagger_1.SwaggerModule.setup(app_constants_1.SWAGGER_PATH, app, swaggerDocument, {
        swaggerOptions: {
            persistAuthorization: true
        }
    });
}
