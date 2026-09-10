import { INestApplication, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';

export function configureApp(app: INestApplication) {
  app.use(helmet());
  app.setGlobalPrefix('v1');
  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
  );
  app.enableShutdownHooks();
}
