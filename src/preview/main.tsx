// 미리보기 단일 페이지: Next.js 앱과 같은 화면(src/views)을 #해시 경로로 연다.
// claude.ai 아티팩트처럼 정적 파일만 올리는 곳에서 쓰기 위한 진입점이다.
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../app/globals.css';
import { parseHash, type Route } from '@/platform/types';
import { FIGURES, LESSON_MAP, ROUTINES } from '@/content';
import { HomeView } from '@/views/HomeView';
import { LessonView } from '@/views/LessonView';
import { StepsView } from '@/views/StepsView';
import { StepPracticeView } from '@/views/StepPracticeView';
import { RoutinesView } from '@/views/RoutinesView';
import { RoutinePracticeView } from '@/views/RoutinePracticeView';
import { ReviewView } from '@/views/ReviewView';
import { SettingsView } from '@/views/SettingsView';
import { HelpView } from '@/views/HelpView';
import { SourcesView } from '@/views/SourcesView';
import { NotFoundView } from '@/views/NotFoundView';

const APP = '라인댄스 첫걸음 3D';

function titleOf(r: Route): string {
  switch (r.name) {
    case 'lesson': {
      const l = LESSON_MAP[r.id];
      return l ? `Lv${l.level} ${l.title} · ${APP}` : APP;
    }
    case 'step':
      return `${FIGURES[r.id]?.nameKo ?? '동작'} 자유 연습 · ${APP}`;
    case 'routine':
      return `${ROUTINES[r.id]?.nameKo ?? '연결 연습'} · ${APP}`;
    case 'steps':
      return `스텝 사전 · ${APP}`;
    case 'routines':
      return `연결 연습 · ${APP}`;
    case 'review':
      return `검수 모드 · ${APP}`;
    case 'settings':
      return `설정 · ${APP}`;
    case 'help':
      return `도움말 · ${APP}`;
    case 'sources':
      return `출처 · 이용 안내 · ${APP}`;
    default:
      return APP;
  }
}

function App() {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const on = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => {
    document.title = titleOf(route);
  }, [route]);
  switch (route.name) {
    case 'home':
      return <HomeView />;
    case 'lesson':
      return <LessonView key={route.id} id={route.id} />;
    case 'steps':
      return <StepsView />;
    case 'step':
      return <StepPracticeView key={route.id} id={route.id} />;
    case 'routines':
      return <RoutinesView />;
    case 'routine':
      return <RoutinePracticeView key={route.id} id={route.id} />;
    case 'review':
      return <ReviewView />;
    case 'settings':
      return <SettingsView />;
    case 'help':
      return <HelpView />;
    case 'sources':
      return <SourcesView />;
    default:
      return <NotFoundView />;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
