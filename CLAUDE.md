# CLAUDE.md — 라인댄스 첫걸음 3D

## 반드시 지킬 것
- **구현 전에 `docs/DESIGN.md`의 해당 장을 먼저 읽는다.** 장 번호로 요청이 오면(예: "8.4대로") 그 장을 기준으로 만든다.
- `src/engine`은 순수 TypeScript다. React · three.js · DOM · `src/store`를 import하지 않는다 (8.0, 9.2). 엔진 파일끼리만 import한다.
- 좌표 변환식은 `src/engine/geometry.ts`(바닥 · SVG)와 `src/render3d/coords.ts`(three.js)에만 둔다 (7.1, 12장).
- 화면은 `player.beat()`(오디오 시계에서 계산한 박)만 본다. `setInterval`로 박을 세지 않는다 (8.3, 8.8).
- 매 프레임 React 상태를 바꾸지 않는다. 그림은 `useFrameCallback` / R3F `useFrame`에서 직접 갱신하고, 카운트 · 블록처럼 느린 값만 `useFrameInfo` 스토어로 받는다.
- 동작 수치와 문구는 `src/content/*.json`에만 있다. 코드에 하드코딩하지 않는다 (1.2).
- 수치를 바꾸면 `npm test`와 `npm run check:content`로 11.1 기준값 · 8.2 검증을 다시 확인한다.
- 출처의 원문 · 영상 · 이미지 · 음악은 넣지 않는다. 링크만 (2.5).

## 명령
| 명령 | 하는 일 |
|---|---|
| `npm run dev` | Next.js 개발 서버 |
| `npm run build` | 정적 내보내기 (`out/`) |
| `npm run build:preview` | 단일 페이지 미리보기 빌드 (`dist-preview/`, #해시 경로) |
| `npm test` | Vitest — 11.1 기준값 테스트 |
| `npm run typecheck` · `npm run lint` | 타입 · 린트 |
| `npm run demo:footmap` | 블록 8종의 발 위치도 SVG → `docs/footmaps/` |
| `npm run check:content [보폭m]` | 콘텐츠 전체 검증 표 (8.2, 부록 A.4) |

## 구조 요약
- `src/engine/` 합성(compose) · 검증(validate) · 타임라인 · 발 궤적(footPath) · 체중(weight) · 자세(pose) · IK · 퀴즈 · 스케줄러 · 클릭음
- `src/content/` 동작 · 블록 · 루틴 · 연습 · 레슨 · 출처 JSON과 `index.ts` 레지스트리
- `src/lib/` 재생기(player) · 프레임 버스 · 연습 세션 · 저장소
- `src/render2d/` 발 위치도 · 카운트 바 · 체중 막대, `src/render3d/` 3D 무대
- `src/views/` 화면 (Next.js 앱과 미리보기가 함께 쓴다), `src/platform/` 경로 · 링크 · 3D 불러오기의 플랫폼별 구현
- `src/app/` Next.js 라우트, `src/preview/` + `preview/index.html` 미리보기 진입점
