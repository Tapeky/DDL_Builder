export type Category = 'weapon' | 'vitality' | 'spirit';
export type Style = 'balanced' | 'damage' | 'survival';
export type Phase = 'early' | 'core' | 'late';
export type EditorialBuildStatus =
  'draft' | 'review' | 'validated' | 'published' | 'stale' | 'archived';
export type FarmPriority = 1 | 2 | 3 | 4 | 5 | 6;
export type TacticalProfileStatus = 'draft' | 'validated' | 'stale';
export type TacticalTagKey =
  | 'anti_heal'
  | 'anti_mobility'
  | 'anti_burst'
  | 'anti_bullet'
  | 'anti_spirit'
  | 'anti_control'
  | 'anti_range'
  | 'anti_regeneration';
export type ReferencePlayerVerificationStatus = 'pending' | 'verified' | 'stale' | 'rejected';
export type AnalyticsRunStatus = 'running' | 'succeeded' | 'failed';
export type AnalyticsMetric = 'item-stats';

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
  tacticalTags: TacticalTagDefinition[];
  tacticalProfiles: HeroTacticalProfile[];
}

export interface TacticalTagDefinition {
  key: TacticalTagKey;
  label: string;
  description: string;
}

export interface TacticalTagAssignment {
  key: TacticalTagKey;
  intensity: 1 | 2 | 3;
  evidence: string;
  status: TacticalProfileStatus;
}

export interface HeroTacticalProfile {
  heroId: number;
  status: TacticalProfileStatus;
  source: string;
  tags: TacticalTagAssignment[];
}

export interface InvestmentTarget {
  branch: Category;
  phase: Phase;
  threshold: number;
  priority: 'required' | 'preferred';
  reason: string;
}

export interface RecommendationRequest {
  heroId: number;
  style: Style;
  farmPriority?: FarmPriority;
  opponentHeroIds?: number[];
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
  investments: InvestmentTarget[];
  farmPriority: FarmPriority;
  opponents: Hero[];
  threats: RecommendationThreat[];
  adaptations: RecommendationAdaptation[];
  steps: BuildStep[];
  warnings: string[];
  evidence: 'editorial-draft';
  sharePath: string;
}

export interface RecommendationThreat {
  heroId: number;
  heroName: string;
  tag: TacticalTagKey;
  intensity: 1 | 2 | 3;
  explanation: string;
}

export interface RecommendationAdaptation {
  order: number;
  fromItem: string;
  toItem: string;
  reason: string;
  threatTags: TacticalTagKey[];
}

export interface ReferencePlayer {
  id: string;
  displayName: string;
  region: string;
  accountIds: number[];
  heroIds: number[];
  verificationStatus: ReferencePlayerVerificationStatus;
  verificationSource: string;
  verifiedAt: string | null;
  lastSeenAt: string | null;
  sourceUrl: string | null;
  notes: string;
}

export interface AnalyticsFilters {
  gameMode: 'normal' | 'street_brawl' | 'explore_n_y_c' | 'internal';
  matchMode: string;
  minUnixTimestamp: number;
  maxUnixTimestamp: number | null;
  minMatches: number;
  minAverageBadge: number | null;
  maxAverageBadge: number | null;
  minNetworth: number | null;
  maxNetworth: number | null;
  enemyHeroIds: number[];
  enemyHeroIdsAllMatch: boolean;
  sameLaneFilter: boolean;
}

export interface AnalyticsItemStat {
  itemId: number;
  bucket: number;
  wins: number;
  losses: number;
  matches: number;
  players: number;
  avgBuyTimeS: number;
  avgSellTimeS: number;
  avgBuyTimeRelative: number;
  avgSellTimeRelative: number;
}

export interface AnalyticsRunSummary {
  id: string;
  snapshotId: string;
  heroId: number;
  metric: AnalyticsMetric;
  status: AnalyticsRunStatus;
  source: string;
  filters: AnalyticsFilters;
  rowCount: number | null;
  errorCode: string | null;
  startedAt: string;
  completedAt: string | null;
}
