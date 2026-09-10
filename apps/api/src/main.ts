import './env';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';

async function main() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
    bodyParser: true,
  });
  configureApp(app);
  const config = new DocumentBuilder()
    .setTitle('Deadlock Builder')
    .setDescription('Catalogue versionné et builds expérimentaux.')
    .setVersion('0.1.0')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
  await app.listen(Number(process.env.PORT ?? 3001), process.env.HOST ?? '127.0.0.1');
}

void main().catch(() => {
  console.error('API_START_FAILED: vérifiez la configuration et la disponibilité de PostgreSQL.');
  process.exitCode = 1;
});
