import type { Highlight, Settings } from '@/engine/types';

export interface StageProps {
  settings: Settings;
  /** 퀴즈 중: 답이 보이는 표시(발자국 · 화살표 · 다음 발)를 숨긴다 */
  mask?: boolean;
  highlight?: Highlight[];
  className?: string;
  /** 30fps 아래가 3초 이어져 그림자 · 궤적을 껐을 때 */
  onDegrade?: () => void;
}
