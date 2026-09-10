export type Category = 'weapon' | 'vitality' | 'spirit';
export type Style = 'balanced' | 'damage' | 'survival';
export type Phase = 'early' | 'core' | 'late';

export interface Hero {
  id: number;
  name: string;
  description: string;
  image: string | null;
  portrait: string | null;
  complexity: number;
  hasBuild: boolean;
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
}

export interface Recommendation {
  id: string;
  hero: Hero;
  style: Style;
  title: string;
  summary: string;
  version: string;
  engineVersion: string;
  importedAt: string;
  totalCost: number;
  steps: BuildStep[];
  warnings: string[];
  evidence: 'editorial-draft';
  sharePath: string;
}
