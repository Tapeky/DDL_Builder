import { Module } from '@nestjs/common';
import { EditorialBuildService } from './editorial.service';

@Module({ providers: [EditorialBuildService], exports: [EditorialBuildService] })
export class EditorialModule {}
