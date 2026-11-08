// 다음 자세 미리 보기 (설계문서 6.6): 반투명 마네킹이 보여 줄 박.
// = 지금 박 다음의 '착지 자세' 박 — 한 카운트씩 ▷를 누르면 가는 곳(8.3). 그래서 미리 본 자세와 ▷의 결과가 같다.
import type { Settings } from '@/engine/types';
import type { Track } from '@/engine/track';
import { nextRest, type PlayStatus } from './player';

export function ghostBeat(track: Track, beat: number, status: PlayStatus, mode: Settings['ghost']): number | null {
  if (mode === 'off' || status === 'ended') return null;
  if (mode === 'paused' && status === 'playing') return null;
  const r = nextRest(track, beat);
  return r ? r.rest : null;
}
