'use client';
// 슬라이더 · 스위치 · 탭 · 대화상자 · 선택 버튼 묶음 (Radix 기반, shadcn/ui 방식)
import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

export function Slider({ className, ...props }: React.ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root className={cn('relative flex h-[var(--btn-h)] w-full touch-none select-none items-center', className)} {...props}>
      <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-line">
        <SliderPrimitive.Range className="absolute h-full bg-ink" />
      </SliderPrimitive.Track>
      {(props.value ?? props.defaultValue ?? [0]).map((_, i) => (
        <SliderPrimitive.Thumb
          key={i}
          aria-label={props['aria-label']}
          className="block h-6 w-6 rounded-full border-[3px] border-ink bg-surface focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink"
        />
      ))}
    </SliderPrimitive.Root>
  );
}

export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'peer inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-line-strong transition-colors data-[state=checked]:bg-ink',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block h-6 w-6 rounded-full bg-surface transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0" />
    </SwitchPrimitive.Root>
  );
}

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn('flex gap-1 border-b border-line', className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        '-mb-px min-h-[var(--btn-h)] border-b-[3px] border-transparent px-3 text-[15px] font-semibold text-muted data-[state=active]:border-ink data-[state=active]:text-ink',
        className,
      )}
      {...props}
    />
  );
}

export const TabsContent = TabsPrimitive.Content;

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({ className, children, title, description, ...props }: React.ComponentProps<typeof DialogPrimitive.Content> & { title: string; description?: string }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/40" />
      <DialogPrimitive.Content
        className={cn('ld-pop fixed left-1/2 top-1/2 z-50 w-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2 rounded-[14px] border border-line bg-surface p-6', className)}
        {...props}
      >
        <DialogPrimitive.Title className="pr-10 text-xl font-bold">{title}</DialogPrimitive.Title>
        {description ? <DialogPrimitive.Description className="mt-2 text-muted">{description}</DialogPrimitive.Description> : <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>}
        <div className="mt-4">{children}</div>
        <DialogPrimitive.Close className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-ink/[0.06]" aria-label="닫기">
          <X className="h-5 w-5" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export interface SegmentOption<T extends string | number> {
  value: T;
  label: React.ReactNode;
  title?: string;
}

/** 여러 값 중 하나를 고르는 버튼 묶음 (라디오 그룹) */
export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
  className,
  size = 'md',
}: {
  value: T;
  options: SegmentOption<T>[];
  onChange: (v: T) => void;
  label: string;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const idx = options.findIndex((o) => o.value === value);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    e.stopPropagation();
    const n = (idx + (e.key === 'ArrowRight' ? 1 : -1) + options.length) % options.length;
    onChange(options[n].value);
    refs.current[n]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex flex-wrap gap-1', className)} onKeyDown={onKey}>
      {options.map((o, i) => (
        <button
          key={String(o.value)}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={o.value === value || (idx < 0 && i === 0) ? 0 : -1}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-[8px] border font-semibold transition-colors',
            size === 'sm' ? 'min-h-9 px-2.5 text-sm' : 'min-h-[var(--btn-h)] px-3 text-[15px]',
            o.value === value ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-ink hover:border-line-strong',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <span className="text-sm font-semibold text-ink-2">{label}</span>
      {children}
      {hint ? <span className="text-sm text-muted">{hint}</span> : null}
    </div>
  );
}
