import { Module } from '@nestjs/common';
import { ReferencePlayerService } from './reference-player.service';
import { LeaderboardService } from './leaderboard.service';

@Module({
  providers: [ReferencePlayerService, LeaderboardService],
  exports: [ReferencePlayerService, LeaderboardService],
})
export class ReferencesModule {}
