import { Module } from '@nestjs/common';
import { ReferencePlayerService } from './reference-player.service';

@Module({ providers: [ReferencePlayerService], exports: [ReferencePlayerService] })
export class ReferencesModule {}
