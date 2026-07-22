import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getChallenge, reportChallenge, submitPlay } from '../api';
import type { ChallengeView } from '../types';

type Phase = 'loading' | 'not-found' | 'inactive' | 'ready' | 'playing' | 'result';

const RESULT_MESSAGES: [number, string][] = [
  [100, '완벽한 위장술! 친구가 백기를 들었어요 🏳️'],
  [70, '거의 다 봤어요! 아쉽게 놓친 게 있네요 🔍'],
  [40, '꽤 잘 숨겼네요. 절반은 통했어요 😼'],
  [0, '들켰어요! 위장 실력을 더 갈고닦아 보세요 🙈'],
];

function resultMessage(score: number) {
  return RESULT_MESSAGES.find(([min]) => score >= min)?.[1] ?? '';
}

export default function Play() {
  const { id } = useParams<{ id: string }>();
  const [phase, setPhase] = useState<Phase>('loading');
  const [challenge, setChallenge] = useState<ChallengeView | null>(null);
  const [foundIdx, setFoundIdx] = useState<Set<number>>(new Set());
  const [remaining, setRemaining] = useState(0);
  const [hintQuadrant, setHintQuadrant] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [result, setResult] = useState<{ score: number; success: boolean; foundCount: number; totalCount: number; duration: number } | null>(
    null
  );
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportSubmitted, setReportSubmitted] = useState(false);

  const missStreak = useRef(0);
  const startTime = useRef(0);
  const endedRef = useRef(false);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    getChallenge(id)
      .then((c) => {
        setChallenge(c);
        setRemaining(c.timeLimitSeconds);
        setPhase('ready');
      })
      .catch((err) => {
        setPhase(err?.status === 410 ? 'inactive' : 'not-found');
      });
  }, [id]);

  useEffect(() => {
    if (phase !== 'playing' || !challenge) return;
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime.current) / 1000;
      const left = Math.max(0, challenge.timeLimitSeconds - elapsed);
      setRemaining(left);
      if (left <= 0) endGame(false);
    }, 200);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, challenge]);

  function startGame() {
    if (!challenge) return;
    endedRef.current = false;
    setFoundIdx(new Set());
    missStreak.current = 0;
    startTime.current = Date.now();
    setPhase('playing');
  }

  async function endGame(success: boolean, foundCountOverride?: number) {
    if (endedRef.current || !challenge || !id) return;
    endedRef.current = true;
    const elapsed = Math.min(challenge.timeLimitSeconds, (Date.now() - startTime.current) / 1000);
    const foundCount = foundCountOverride ?? foundIdx.size;
    try {
      const res = await submitPlay(id, {
        foundCount,
        totalCount: challenge.characterCount,
        durationSeconds: Number(elapsed.toFixed(1)),
      });
      setResult({ score: res.score, success: res.success, foundCount: res.foundCount, totalCount: res.totalCount, duration: elapsed });
    } catch {
      const totalCount = challenge.characterCount;
      const score = Math.round((foundCount / totalCount) * 100);
      setResult({ score, success, foundCount, totalCount, duration: elapsed });
    }
    setPhase('result');
  }

  function handleTap(e: React.PointerEvent<HTMLDivElement>) {
    if (phase !== 'playing' || !challenge || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    let hitIndex = -1;
    challenge.hitRegions.forEach((r, i) => {
      if (foundIdx.has(i) || hitIndex !== -1) return;
      const dx = (x - r.x) / r.rx;
      const dy = (y - r.y) / r.ry;
      if (dx * dx + dy * dy <= 1) hitIndex = i;
    });

    if (hitIndex !== -1) {
      const next = new Set(foundIdx);
      next.add(hitIndex);
      setFoundIdx(next);
      missStreak.current = 0;
      setHintQuadrant(null);
      if (next.size === challenge.characterCount) endGame(true, next.size);
    } else {
      missStreak.current += 1;
      if (missStreak.current >= challenge.hintAfterMisses) {
        missStreak.current = 0;
        const unfoundIndices = challenge.hitRegions.map((_, i) => i).filter((i) => !foundIdx.has(i));
        if (unfoundIndices.length > 0) {
          const r = challenge.hitRegions[unfoundIndices[Math.floor(Math.random() * unfoundIndices.length)]];
          const x0 = r.x < 0.5 ? 0 : 0.5;
          const y0 = r.y < 0.5 ? 0 : 0.5;
          setHintQuadrant({ x0, y0, x1: x0 + 0.5, y1: y0 + 0.5 });
          setTimeout(() => setHintQuadrant(null), 2200);
        }
      }
    }
  }

  async function submitReport() {
    if (!id || !reportReason.trim()) return;
    try {
      await reportChallenge(id, reportReason.trim());
      setReportSubmitted(true);
    } catch {
      alert('신고 접수에 실패했어요. 잠시 후 다시 시도해주세요.');
    }
  }

  if (phase === 'loading') return <div className="page center-page">불러오는 중...</div>;
  if (phase === 'not-found') return <div className="page center-page">챌린지를 찾을 수 없어요.</div>;
  if (phase === 'inactive') return <div className="page center-page">제작자가 이 챌린지 링크를 비활성화했어요.</div>;
  if (!challenge) return null;

  if (phase === 'ready') {
    return (
      <div className="page center-page">
        <h1>{challenge.title}</h1>
        <p className="muted">
          숨겨진 캐릭터 {challenge.characterCount}개를 {challenge.timeLimitSeconds}초 안에 모두 찾아보세요!
        </p>
        <img className="preview-img" src={challenge.compositeImage} alt="챌린지 미리보기" />
        <button className="btn btn-primary" onClick={startGame}>
          시작하기
        </button>
      </div>
    );
  }

  if (phase === 'result' && result) {
    const missed = challenge.hitRegions.map((r, i) => ({ r, i })).filter(({ i }) => !foundIdx.has(i));
    return (
      <div className="page center-page">
        <h1>{result.success ? '성공!' : '시간 종료'}</h1>
        <div className="play-stage" ref={stageRef}>
          <img src={challenge.compositeImage} alt="결과" />
          {[...foundIdx].map((i) => (
            <span
              key={i}
              className="marker marker-found"
              style={{ left: `${challenge.hitRegions[i].x * 100}%`, top: `${challenge.hitRegions[i].y * 100}%` }}
            />
          ))}
          {!result.success &&
            missed.map(({ r, i }) => (
              <span key={i} className="marker marker-missed" style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%` }} />
            ))}
        </div>
        <p className="score-big">{result.score}점</p>
        <p>
          {result.foundCount} / {result.totalCount} 찾음 · {result.duration.toFixed(1)}초
        </p>
        <p className="muted">{resultMessage(result.score)}</p>
        {!reportOpen && !reportSubmitted && (
          <button className="btn btn-ghost small" onClick={() => setReportOpen(true)}>
            부적절한 챌린지 신고
          </button>
        )}
        {reportOpen && !reportSubmitted && (
          <div className="report-box">
            <textarea
              placeholder="신고 사유를 입력해주세요"
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              maxLength={500}
            />
            <div className="action-row">
              <button className="btn btn-secondary" onClick={submitReport} disabled={!reportReason.trim()}>
                신고하기
              </button>
              <button className="btn btn-ghost" onClick={() => setReportOpen(false)}>
                취소
              </button>
            </div>
          </div>
        )}
        {reportSubmitted && <p className="muted small">신고가 접수되었어요.</p>}
      </div>
    );
  }

  // playing
  const progress = challenge.timeLimitSeconds > 0 ? remaining / challenge.timeLimitSeconds : 0;
  return (
    <div className="page center-page">
      <div className="timer-bar-track">
        <div className="timer-bar-fill" style={{ width: `${progress * 100}%` }} />
      </div>
      <p className="muted">
        남은 시간 {remaining.toFixed(1)}초 · 찾은 개수 {foundIdx.size}/{challenge.characterCount}
      </p>
      <div className="play-stage" ref={stageRef} onPointerDown={handleTap}>
        <img src={challenge.compositeImage} alt="챌린지" draggable={false} />
        {[...foundIdx].map((i) => (
          <span
            key={i}
            className="marker marker-found"
            style={{ left: `${challenge.hitRegions[i].x * 100}%`, top: `${challenge.hitRegions[i].y * 100}%` }}
          />
        ))}
        {hintQuadrant && (
          <span
            className="hint-quadrant"
            style={{
              left: `${hintQuadrant.x0 * 100}%`,
              top: `${hintQuadrant.y0 * 100}%`,
              width: `${(hintQuadrant.x1 - hintQuadrant.x0) * 100}%`,
              height: `${(hintQuadrant.y1 - hintQuadrant.y0) * 100}%`,
            }}
          />
        )}
      </div>
    </div>
  );
}
