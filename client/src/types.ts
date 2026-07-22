export interface HitRegion {
  x: number; // center, relative 0..1
  y: number;
  rx: number; // radius, relative to width
  ry: number; // radius, relative to height
}

export interface ChallengeView {
  id: string;
  title: string;
  compositeImage: string;
  characterCount: number;
  hitRegions: HitRegion[];
  timeLimitSeconds: number;
  hintAfterMisses: number;
  active: boolean;
  playCount: number;
  createdAt: string;
}

export interface CreateChallengeResponse {
  id: string;
  creatorToken: string;
}

export interface PlayResultResponse {
  score: number;
  success: boolean;
  foundCount: number;
  totalCount: number;
}

export interface MyChallengeEntry {
  id: string;
  creatorToken: string;
  title: string;
  createdAt: string;
}
