import { Module } from '@nestjs/common';
import { TacticalService } from './tactical.service';

@Module({ providers: [TacticalService], exports: [TacticalService] })
export class TacticalModule {}
