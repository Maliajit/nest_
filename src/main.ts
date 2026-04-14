import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { BigIntInterceptor } from './common/interceptors/bigint.interceptor';

// Use a BigInt to JSON patch to avoid serialization errors (redundant with interceptor but helpful for direct JSON.stringify)
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  
  // Serve static uploads
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });
  
  // Enable CORS
  app.enableCors({
    origin: '*', // Simplified for dev testing
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Global BigInt interceptor
  app.useGlobalInterceptors(new BigIntInterceptor());

  // Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('Fylex API Docs')
    .setDescription('Fylex E-Commerce Backend Endpoints')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
