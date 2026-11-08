'use client';
// 도움말 (6.1 '/help'): 화면 읽는 법 · 용어 · 단축키 · 소리가 안 날 때
import { AppShell } from '@/components/AppShell';
import { DraftBadge } from '@/components/DraftBadge';
import { FootBadge } from '@/render2d/CountBar';
import { AppLink } from '@/platform';

const TERMS: [string, string, string][] = [
  ['카운트', 'count', '음악 한 박에 맞춘 동작 단위. 8개씩 묶어 셉니다.'],
  ['앤 카운트', '& (and)', "두 카운트 사이의 반 박. 카운트 바의 좁은 '&' 칸."],
  ['디딤', 'step', '발을 딛고 체중을 옮깁니다. 채운 발자국 ●.'],
  ['터치', 'touch', '앞꿈치만 대고 체중은 옮기지 않습니다. 빈 발자국 ○.'],
  ['지지발', 'supporting foot', '지금 체중이 실린 발. 진한 신발과 바닥의 체중 원.'],
  ['자유발', 'free foot', '체중이 없어 다음에 움직일 수 있는 발.'],
  ['홈', 'home', '두 발을 모으고 선 기준 자리. 점선 발자국.'],
  ['준비 자세', 'ready', '홈에서 체중을 왼발에 둔 상태. 오른발부터 시작합니다.'],
  ['교차', 'cross', '한 발이 다른 발의 앞이나 뒤로 넘어가 딛습니다. 화살표가 지지발을 돌아갑니다.'],
  ['벽', 'wall', '춤의 정면. 시계로 부릅니다: 12시(시작) · 3시 · 6시 · 9시.'],
  ['회전', 'turn', '몸 방향을 바꿉니다. 1/4 = 90°. 보라색 호 ↻.'],
  ['이동 각도', 'travel angle', '발이 나아가는 각도. 몸 방향과 별개입니다(V스텝).'],
  ['블록', '8-count section', '8카운트 한 묶음.'],
  ['루틴', 'routine', '블록을 이은 한 벽 분량의 연습 순서.'],
  ['보폭 단위', 'u', '좌표 단위. 1u = 0.36 m (기본). 발 위치도의 눈금은 0.5u.'],
];

const KEYS: [string, string][] = [
  ['Space', '재생 / 일시정지'],
  ['Esc', '정지 (준비 자세로)'],
  ['← / →', '한 카운트씩 이전 / 다음'],
  ['↑ / ↓', 'BPM ±4'],
  ['L', '루프 켜기 / 끄기'],
  ['1 ~ 5', '시점: 뒤에서 · 거울 · 위에서 · 옆에서 · 자유'],
  ['M', '음소거'],
  ['F', '발 위치도 크게 보기'],
  ['Z', '발 확대 켜기 / 끄기'],
];

export function HelpView() {
  return (
    <AppShell section="help">
      <h1 className="mb-6 font-display text-[40px] leading-tight">도움말</h1>
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <section className="rounded-[14px] border border-line bg-surface p-5">
          <h2 className="mb-3 text-xl font-bold">화면 읽는 법</h2>
          <ul className="flex flex-col gap-3 text-[16px]">
            <li className="flex items-center gap-3">
              <FootBadge foot="L" />
              <FootBadge foot="R" />
              <span>왼발은 파랑 L, 오른발은 주황 R. 색과 글자를 함께 씁니다.</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="w-12 text-center text-xl">● ○</span>
              <span>채운 발자국은 디딤(체중을 옮김), 빈 발자국은 터치(체중 없음).</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="inline-block h-8 w-12 rounded-[6px] border-2 border-dashed border-ink" aria-hidden />
              <span>점선은 다음 걸음 또는 홈. 다음 발자국은 천천히 깜빡입니다.</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="w-12 text-center text-xl font-bold text-turn">↻</span>
              <span>보라색은 회전. 회전하는 걸음 1박 전부터 호와 ‘1/4 오른쪽’이 뜹니다.</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="inline-flex w-12 justify-center" aria-hidden>
                <span className="h-4 w-4 rounded-full bg-pelvis" />
              </span>
              <span>초록 점과 선은 골반(몸 중심)의 자리와 최근 2박의 궤적.</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="inline-flex w-12 justify-center" aria-hidden>
                <span className="h-8 w-5 rounded-full border-2 border-ink/40 bg-ink/10" />
              </span>
              <span>반투명한 다리 · 신발은 다음 카운트의 자세입니다(▷를 누르면 갈 자리). 보기 옵션에서 ‘항상’ 또는 ‘끔’으로 바꿀 수 있습니다.</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="w-12 text-center text-xl font-bold" aria-hidden>
                ↔
              </span>
              <span>3D 무대를 좌우로 끌면 동작을 앞뒤로 천천히 훑어봅니다(무대 폭 = 8박). 재생 중이면 멈춥니다.</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="w-12 text-center font-display text-2xl">1 5</span>
              <span>카운트 바의 1과 5는 굵게. 1 · 5카운트의 클릭음은 높고 깁니다.</span>
            </li>
            <li className="flex items-center gap-3">
              <DraftBadge compact />
              <span>강사 검수를 거치기 전의 초기값입니다. 교재에 따라 다를 수 있습니다.</span>
            </li>
          </ul>
          <h3 className="mb-2 mt-6 text-lg font-bold">시점</h3>
          <p className="text-ink-2">
            <strong>뒤에서</strong>(기본)는 내 좌우가 아바타의 좌우와 같아 그대로 따라 하면 됩니다. <strong>거울</strong>은 아바타가 나를 마주 보고, 화면 오른쪽의 주황 R 발이 움직이면 내 오른발을 움직입니다(거울 앞에서 추는 것과 같습니다).
            <strong> 위에서</strong>는 발 위치도와 같은 구도, <strong>옆에서</strong>는 앞뒤 이동과 보폭을 볼 때 씁니다. <strong>발 확대</strong>를 켜면 카메라가 낮아지고 가까워져 발이
            크게 보입니다.
          </p>
        </section>
        <section className="flex flex-col gap-6">
          <div className="rounded-[14px] border border-line bg-surface p-5">
            <h2 className="mb-3 text-xl font-bold">소리가 안 날 때</h2>
            <ul className="list-disc space-y-2 pl-5 text-ink-2">
              <li>휴대폰 · 태블릿은 재생 버튼을 한 번 눌러야 소리가 켜집니다.</li>
              <li>아이폰 · 아이패드는 옆의 무음 스위치가 켜져 있으면 소리가 나지 않습니다.</li>
              <li>블루투스 스피커는 소리가 늦게 납니다. 설정의 ‘소리와 화면 맞추기’에서 지연 보정을 올리세요.</li>
              <li>소리가 나지 않아도 화면의 카운트와 발은 그대로 움직입니다.</li>
            </ul>
          </div>
          <div className="rounded-[14px] border border-line bg-surface p-5">
            <h2 className="mb-3 text-xl font-bold">3D가 보이지 않을 때</h2>
            <p className="text-ink-2">3D를 쓸 수 없는 기기에서는 발 위치도가 크게 나옵니다. 모든 레슨을 발 위치도만으로 끝까지 할 수 있습니다. 화면이 느리면 그림자와 궤적선을 자동으로 끕니다.</p>
          </div>
          <div className="rounded-[14px] border border-line bg-surface p-5">
            <h2 className="mb-3 text-xl font-bold">키보드 단축키</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              {KEYS.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt>
                    <kbd className="rounded-[6px] border border-line-strong bg-paper px-2 py-0.5 font-semibold">{k}</kbd>
                  </dt>
                  <dd className="text-ink-2">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </div>
      <section className="mt-6 rounded-[14px] border border-line bg-surface p-5">
        <h2 className="mb-3 text-xl font-bold">용어</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-left">
            <thead className="text-sm text-ink-2">
              <tr>
                <th className="py-2 pr-3">용어</th>
                <th className="py-2 pr-3">영문</th>
                <th className="py-2">뜻</th>
              </tr>
            </thead>
            <tbody>
              {TERMS.map(([ko, en, d]) => (
                <tr key={ko} className="border-t border-line">
                  <td className="py-2 pr-3 font-bold">{ko}</td>
                  <td className="py-2 pr-3 text-muted">{en}</td>
                  <td className="py-2">{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm text-muted">
          기본 원칙: 한 번에 한 발만 움직이고, 디딤은 체중을 옮기고 터치는 옮기지 않습니다. 그래서 터치 뒤에는 같은 발이 다시 움직입니다. 자세한 근거는{' '}
          <AppLink to={{ name: 'sources' }} className="font-semibold text-ink underline">
            출처 · 이용 안내
          </AppLink>
          에 있습니다.
        </p>
      </section>
    </AppShell>
  );
}
