import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="page center-page">
      <h1>사진 속 위장 캐릭터</h1>
      <p className="muted">사진 위에 캐릭터를 숨기고, 친구에게 찾아보라고 도전장을 보내보세요!</p>
      <Link className="btn btn-primary" to="/create">
        새 챌린지 만들기
      </Link>
      <Link className="btn btn-secondary" to="/my">
        내 챌린지 목록
      </Link>
    </div>
  );
}
