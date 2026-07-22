import type { MyChallengeEntry } from './types';

const KEY = 'hip_my_challenges';

export function listMyChallenges(): MyChallengeEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as MyChallengeEntry[]) : [];
  } catch {
    return [];
  }
}

export function addMyChallenge(entry: MyChallengeEntry) {
  const list = listMyChallenges();
  list.unshift(entry);
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function removeMyChallenge(id: string) {
  const list = listMyChallenges().filter((c) => c.id !== id);
  localStorage.setItem(KEY, JSON.stringify(list));
}
