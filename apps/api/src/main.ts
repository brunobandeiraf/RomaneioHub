import { NestFactory } from '@nestjs/core';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Enable rawBody so that Stripe webhook signature validation works.
    // The raw body is available as req.rawBody on routes that need it.
    rawBody: true,
  });

  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: (errors) => {
        const validationErrors = errors.map((error) => ({
          property: error.property,
          constraints: error.constraints || {},
        }));
        return new BadRequestException({
          message: 'Validation failed',
          errors: validationErrors,
        });
      },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🚀 API running on http://localhost:${port}`);
}

bootstrap();
