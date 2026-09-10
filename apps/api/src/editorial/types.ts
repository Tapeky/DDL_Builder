import type { EditorialBuildStatus, Phase, Style } from '@deadlock/contracts';

export interface EditorialAlternativeInput {
  itemClassName: string;
  reason?: string;
}

export interface EditorialStepInput {
  order: number;
  phase: Phase;
  itemClassName: string;
  reason: string;
  alternatives?: EditorialAlternativeInput[];
}

export interface EditorialProfileInput {
  heroId: number;
  style: Style;
  title: string;
  summary: string;
  status?: EditorialBuildStatus;
  steps: EditorialStepInput[];
}

export interface EditorialProfile extends EditorialProfileInput {
  status: EditorialBuildStatus;
}
