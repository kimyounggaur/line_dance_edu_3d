import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-ui)] font-semibold select-none transition-colors disabled:pointer-events-none disabled:opacity-40 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-ink text-white hover:bg-ink-2 active:bg-black',
        outline: 'border-2 border-ink bg-surface text-ink hover:bg-paper',
        quiet: 'border border-line bg-surface text-ink hover:border-line-strong',
        ghost: 'text-ink hover:bg-ink/[0.06]',
        toggle:
          'border border-line bg-surface text-ink hover:border-line-strong aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-white aria-checked:border-ink aria-checked:bg-ink aria-checked:text-white',
        danger: 'bg-danger text-white hover:brightness-95',
      },
      size: {
        md: 'min-h-[var(--btn-h)] px-4 text-[15px]',
        sm: 'min-h-9 px-3 text-sm',
        lg: 'min-h-[calc(var(--btn-h)+8px)] px-6 text-lg',
        icon: 'h-[var(--btn-h)] w-[var(--btn-h)] p-0 text-[15px]',
      },
    },
    defaultVariants: { variant: 'quiet', size: 'md' },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild, type, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';
  return <Comp ref={ref} type={asChild ? undefined : (type ?? 'button')} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
Button.displayName = 'Button';
