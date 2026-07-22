import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { deactivateChallenge, getChallengeForManage } from '../api';
import { listMyChallenges } from '../myChallenges';
import type { MyChallengeEntry } from '../types';

interface Row extends MyChallengeEntry {
  active?: boolean;
  playCount?: number;
  loading: boolean;
  error?: string;
}

export default function MyChallenges() {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    const entries = listMyChallenges();
    setRows(entries.map((e) => ({ ...e, loading: true })));
    entries.forEach(async (e) => {
      try {
        const detail = await getChallengeForManage(e.id, e.creatorToken);
        setRows((prev) =>
          prev.map((r) => (r.id === e.id ? { ...r, active: detail.active, playCount: detail.playCount, loading: false } : r))
        );
      } catch {
        setRows((prev) => prev.map((r) => (r.id === e.id ? { ...r, loading: false, error: '불러오기 실패' } : r)));
      }
    });
  }, []);

  async function handleDeactivate(row: Row) {
    if (!confirm('이 챌린지 링크를 비활성화할까요? 이후에는 친구가 접속할 수 없어요.')) return;
    try {
      await deactivateChallenge(row.id, row.creatorToken);
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, active: false } : r)));
    } catch {
      alert('비활성화에 실패했어요. 다시 시도해주세요.');
    }
  }

  async function handleCopy(row: Row) {
    const url = `${window.location.origin}/c/${row.id}`;
    await navigator.clipboard.writeText(url);
    alert('링크를 복사했어요.');
  }

  return (
    <div className="page">
      <h1>내 챌린지 목록</h1>
      {rows.length === 0 && <p className="muted">아직 만든 챌린지가 없어요.</p>}
      <div className="challenge-list">
        {rows.map((row) => (
          <div key={row.id} className="challenge-row">
            <div className="challenge-row-main">
              <strong>{row.title}</strong>
              <span className="muted small">
                {row.loading ? '불러오는 중...' : row.error ? row.error : `${row.active ? '활성' : '비활성'} · 플레이 ${row.playCount ?? 0}회`}
              </span>
            </div>
            <div className="challenge-row-actions">
              <button className="icon-btn" onClick={() => handleCopy(row)}>
                링크 복사
              </button>
              {row.active && (
                <button className="icon-btn danger" onClick={() => handleDeactivate(row)}>
                  비활성화
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <Link className="btn btn-primary" to="/create">
        새 챌린지 만들기
      </Link>
    </div>
  );
}
