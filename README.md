# 라인댄스 첫걸음 3D

라인댄스 입문자가 기본 동작(스텝터치 → 그레이프바인 → 재즈박스 → V스텝 → 코스터스텝)을 **발 위치 · 좌우 이동 · 체중 이동 · 카운트 · 방향 전환**으로 보고, 박자에 맞춰 따라 하며, 8카운트 블록을 이어 4벽 루틴까지 익히는 웹앱입니다. 설계는 [`docs/DESIGN.md`](docs/DESIGN.md)를 따릅니다.

> 모든 동작 수치는 **검수 전 초안**입니다. 강사 검수(설계문서 11.3)를 거쳐 확정합니다.

## 시작하기
```bash
npm install
npm run dev          # http://localhost:3000
npm test             # 엔진 기준값 테스트 (설계문서 11.1)
npm run build        # 정적 사이트 → out/  (Vercel 등 정적 호스팅)
```

## 화면
| 경로 | 화면 |
|---|---|
| `/` | 학습 지도 — Lv0~Lv7 레슨 |
| `/lesson/[id]` | 레슨: 설명 → 시연 → 발 위치도 → 한 카운트씩 → 따라하기 → 자기 점검 → 퀴즈 |
| `/steps`, `/steps/[id]` | 스텝 사전과 자유 연습 (시작 발 · 변형 · 템포) |
| `/routines`, `/routines/[id]` | 연결 연습: 블록 타임라인 · 블록 반복 · 다음 블록 예고 · 벽 카운터 |
| `/review` | 검수 모드: 카운트별 표 · 수치 조정 · 즉시 재검증 · 메모 · JSON 내보내기 |
| `/settings`, `/help`, `/sources` | 설정(지연 보정 · 보폭) · 도움말 · 출처와 이용 안내 |

단축키: `Space` 재생/일시정지 · `Esc` 정지 · `←/→` 한 카운트씩 · `↑/↓` BPM ±4 · `L` 루프 · `1~5` 시점 · `M` 음소거 · `F` 발 위치도 크게

## 기술
Next.js 15 (App Router, 정적 내보내기) · React 19 · TypeScript · three.js + @react-three/fiber 9 + drei 10 · Tailwind CSS 4 · Radix(shadcn/ui 방식) · Zustand · Web Audio API · Vitest.

## 콘텐츠 고치기
- 동작: `src/content/figures/*.json` (정준형 = 체중 왼발, 오른발부터. 좌표 단위 u, 1u = 0.36 m)
- 블록 · 루틴: `src/content/blocks.json`, `routines.json`
- 연습 · 레슨: `src/content/exercises/*.json`, `src/content/lessons/ko/*.json`
- 고친 뒤 `npm test`와 `npm run check:content`로 검증합니다. 검수 모드에서 내보낸 JSON의 `figures`를 해당 파일에 반영하고 `verification`을 갱신하면 ‘검수 전 초안’ 배지가 사라집니다.

## 미리보기 빌드
`npm run build:preview`는 같은 화면을 `#해시` 경로로 여는 단일 페이지(`dist-preview/`)를 만듭니다. 서버 없이 정적 파일만 올리는 곳에서 씁니다.
