# hide-in-photo

사진 속 위장 캐릭터 소셜 웹게임 — 사진 위에 캐릭터를 숨기고 친구에게 찾아보라고 도전장을 보내는 모바일 웹게임.

## 구조

- `client/` — React + Vite + TypeScript 프론트엔드 (편집기, 플레이 화면 등)
- `server/` — Express + SQLite 백엔드 (챌린지 저장, 공유 링크, 결과 집계)

## 로컬 실행

```bash
# 서버 (포트 4000)
cd server
npm install
npm run dev

# 클라이언트 (포트 5173, /api는 서버로 프록시됨)
cd client
npm install
npm run dev
```

## 배포하기 (실제 폰에서 접속하려면)

백엔드(Railway)를 먼저 배포해 URL을 얻은 다음, 그 URL을 프론트(Vercel) 환경변수로 넣는 순서로 진행합니다.

**1. 백엔드 — Railway**
1. [railway.app](https://railway.app) 로그인 → New Project → **Deploy from GitHub repo** → 이 저장소 선택
2. 서비스 설정에서 **Root Directory**를 `server` 로 지정
3. 별도 빌드/시작 커맨드 설정 불필요 (`server/railway.json`에 이미 정의됨, `node index.js`)
4. 배포 완료 후 Settings → Networking에서 **Generate Domain**으로 공개 URL 발급 (예: `https://xxxx.up.railway.app`)
5. ⚠️ SQLite 파일(`data.sqlite`)은 Railway 볼륨을 별도로 붙이지 않으면 재배포 시 초기화됩니다. 데모/테스트 용도면 무시해도 되고, 데이터를 유지하려면 Railway에서 Volume을 추가해 `server` 디렉터리에 마운트하세요.

**2. 프론트엔드 — Vercel**
1. [vercel.com](https://vercel.com) 로그인 → Add New Project → 이 저장소 Import
2. **Root Directory**를 `client` 로 지정 (Framework Preset은 Vite로 자동 인식됨)
3. Environment Variables에 `VITE_API_BASE_URL` = 1번에서 발급받은 Railway URL(끝에 `/` 없이) 추가
4. Deploy — 완료되면 나오는 `https://xxxx.vercel.app` 링크가 실제 폰에서 열 수 있는 공개 링크입니다

이후 코드를 수정해 다시 push하면 두 서비스 모두 자동 재배포됩니다.

## 주요 기능

- 사진 위에 기본 캐릭터를 배치·변형하고 브러시로 배경에 맞게 색칠해 위장 캐릭터 제작
- 찾은 캐릭터 수 / 전체 수 비율로 위장 점수(0~100점) 산정
- 카카오톡 등 기기 기본 공유 기능으로 챌린지 링크 전송 (회원가입 불필요)
- 제한 시간 내 숨겨진 캐릭터를 터치해서 찾는 게임, 반복 실패 시 힌트 제공
- 제작자의 공유 링크 비활성화, 플레이어의 부적절한 콘텐츠 신고
