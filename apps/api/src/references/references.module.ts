import { Module } from '@nestjs/common';
import { ReferencePlayerService } from './reference-player.service';
import { LeaderboardService } from './leaderboard.service';
import { ReferenceEvidenceService } from './reference-evidence.service';

@Module({
  providers: [ReferencePlayerService, LeaderboardService, ReferenceEvidenceService],
  exports: [ReferencePlayerService, LeaderboardService, ReferenceEvidenceService],
})
export class ReferencesModule {}
