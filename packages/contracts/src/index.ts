export type Category = 'weapon' | 'vitality' | 'spirit';
export type Style = 'balanced' | 'damage' | 'survival';
export type Phase = 'early' | 'core' | 'late';
export type EditorialBuildStatus =
  'draft' | 'review' | 'validated' | 'published' | 'stale' | 'archived';

export interface Hero {
  id: number;
  name: string;
  description: string;
  image: string | null;
  portrait: string | null;
  complexity: number;
  hasBuild: boolean;
  buildStatus?:
    Exclude<EditorialBuildStatus, 'draft' | 'review' | 'validated' | 'archived'> | 'none';
}

export interface Item {
  id: number;
  name: string;
  className: string;
  image: string | null;
  category: Category;
  tier: number;
  cost: number;
  description: string;
  components: number[];
}

export interface DataStatus {
  state: 'ready' | 'stale' | 'unavailable';
  version: string | null;
  importedAt: string | null;
  checkedAt: string | null;
  source: string;
  heroCount: number;
  itemCount: number;
  publishedBuildCount?: number;
  staleBuildCount?: number;
  notice: string;
}

export interface Catalog {
  heroes: Hero[];
  items: Item[];
  status: DataStatus;
}

export interface RecommendationRequest {
  heroId: number;
  style: Style;
  version?: string;
}

export interface BuildStep {
  order: number;
  phase: Phase;
  item: Item;
  purchaseCost: number;
  reason: string;
  replaces: number[];
  alternatives: Item[];
}

export interface Recommendation {
  id: string;
  hero: Hero;
  style: Style;
  title: string;
  summary: string;
  version: string;
  engineVersion: string;
  buildVersionId: string;
  buildStatus: EditorialBuildStatus;
  importedAt: string;
  totalCost: number;
  steps: BuildStep[];
  warnings: string[];
  evidence: 'editorial-draft';
  sharePath: string;
}
