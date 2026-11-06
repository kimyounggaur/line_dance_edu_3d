// 레슨 본문용 아주 작은 마크다운: 빈 줄 = 문단, **굵게**
import { Fragment } from 'react';

export function Prose({ text, className }: { text: string; className?: string }) {
  const paras = text.split(/\n\s*\n/);
  return (
    <div className={['prose-ld', className].filter(Boolean).join(' ')}>
      {paras.map((p, i) => (
        <p key={i}>
          {p.split('\n').map((line, j) => (
            <Fragment key={j}>
              {j > 0 ? <br /> : null}
              {line.split(/(\*\*[^*]+\*\*)/g).map((seg, k) =>
                seg.startsWith('**') && seg.endsWith('**') ? <strong key={k}>{seg.slice(2, -2)}</strong> : <Fragment key={k}>{seg}</Fragment>,
              )}
            </Fragment>
          ))}
        </p>
      ))}
    </div>
  );
}
