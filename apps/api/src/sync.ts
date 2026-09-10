import './env';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { CatalogService } from './catalog/catalog.service';

async function sync() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    console.log(JSON.stringify(await app.get(CatalogService).sync()));
  } finally {
    await app.close();
  }
}

void sync().catch(() => {
  console.error(
    'DATA_SYNC_FAILED: import impossible ; vérifiez la base, la disponibilité de la source et ses limites d’accès.',
  );
  process.exitCode = 1;
});
