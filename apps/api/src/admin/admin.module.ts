import { Module } from '@nestjs/common';
import { EditorialModule } from '../editorial/editorial.module';
import { AdminController } from './admin.controller';
import { AdminGuard } from './admin.guard';

@Module({
  imports: [EditorialModule],
  controllers: [AdminController],
  providers: [AdminGuard],
})
export class AdminModule {}
