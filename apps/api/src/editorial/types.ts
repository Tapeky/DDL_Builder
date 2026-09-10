import type { Category, EditorialBuildStatus, Phase, Style } from '@deadlock/contracts';

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
  investments?: EditorialInvestmentInput[];
}

export interface EditorialProfile extends EditorialProfileInput {
  status: EditorialBuildStatus;
}

export interface EditorialInvestmentInput {
  branch: Category;
  phase: Phase;
  threshold: number;
  priority: 'required' | 'preferred';
  reason: string;
}
