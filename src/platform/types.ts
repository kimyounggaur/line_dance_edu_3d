// 화면 경로 (설계문서 6.1). Next.js 앱은 주소 경로로, 미리보기 단일 페이지는 #해시로 같은 화면을 연다.
export type Route =
  | { name: 'home' }
  | { name: 'lesson'; id: string; section?: number }
  | { name: 'steps' }
  | { name: 'step'; id: string }
  | { name: 'routines' }
  | { name: 'routine'; id: string }
  | { name: 'review'; id?: string }
  | { name: 'settings' }
  | { name: 'help' }
  | { name: 'sources' }
  | { name: 'notFound' };

export function pathOf(r: Route): string {
  switch (r.name) {
    case 'home':
      return '/';
    case 'lesson':
      return `/lesson/${r.id}/`;
    case 'steps':
      return '/steps/';
    case 'step':
      return `/steps/${r.id}/`;
    case 'routines':
      return '/routines/';
    case 'routine':
      return `/routines/${r.id}/`;
    case 'review':
      return '/review/';
    case 'settings':
      return '/settings/';
    case 'help':
      return '/help/';
    case 'sources':
      return '/sources/';
    default:
      return '/';
  }
}

/** 해시 이름: 영문 · 숫자 · 하이픈만. 'settings'는 아티팩트에서 예약된 이름이라 'options'를 쓴다 */
export function hashOf(r: Route): string {
  switch (r.name) {
    case 'home':
      return '#home';
    case 'lesson':
      return `#lesson-${r.id}`;
    case 'steps':
      return '#steps';
    case 'step':
      return `#step-${r.id}`;
    case 'routines':
      return '#routines';
    case 'routine':
      return `#routine-${r.id}`;
    case 'review':
      return '#review';
    case 'settings':
      return '#options';
    case 'help':
      return '#help';
    case 'sources':
      return '#sources';
    default:
      return '#home';
  }
}

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#/, '');
  if (!h || h === 'home') return { name: 'home' };
  if (h === 'steps') return { name: 'steps' };
  if (h === 'routines') return { name: 'routines' };
  if (h === 'review') return { name: 'review' };
  if (h === 'options') return { name: 'settings' };
  if (h === 'help') return { name: 'help' };
  if (h === 'sources') return { name: 'sources' };
  if (h.startsWith('lesson-')) return { name: 'lesson', id: h.slice(7) };
  if (h.startsWith('step-')) return { name: 'step', id: h.slice(5) };
  if (h.startsWith('routine-')) return { name: 'routine', id: h.slice(8) };
  return { name: 'notFound' };
}

export function sameSection(a: Route, b: Route): boolean {
  const group = (r: Route) => (r.name === 'lesson' ? 'home' : r.name === 'step' ? 'steps' : r.name === 'routine' ? 'routines' : r.name);
  return group(a) === group(b);
}
