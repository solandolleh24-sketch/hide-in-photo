import type { ChallengeView, CreateChallengeResponse, HitRegion, PlayResultResponse } from './types';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || `request failed: ${res.status}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  return res.json();
}

export function createChallenge(payload: {
  title: string;
  compositeImage: string;
  hitRegions: HitRegion[];
  timeLimitSeconds: number;
  hintAfterMisses?: number;
}) {
  return request<CreateChallengeResponse>('/challenges', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getChallenge(id: string) {
  return request<ChallengeView>(`/challenges/${id}`);
}

export function getChallengeForManage(id: string, token: string) {
  return request<ChallengeView>(`/challenges/${id}/manage?token=${encodeURIComponent(token)}`);
}

export function deactivateChallenge(id: string, creatorToken: string) {
  return request<{ ok: true }>(`/challenges/${id}/deactivate`, {
    method: 'PATCH',
    body: JSON.stringify({ creatorToken }),
  });
}

export function reportChallenge(id: string, reason: string) {
  return request<{ ok: true }>(`/challenges/${id}/report`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export function submitPlay(
  id: string,
  payload: { foundCount: number; totalCount: number; durationSeconds: number }
) {
  return request<PlayResultResponse>(`/challenges/${id}/plays`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
