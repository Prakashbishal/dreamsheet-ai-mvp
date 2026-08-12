import { cn } from '../lib/utils';

interface DreamKeyMarkProps {
  variant?: 'brand' | 'compact';
  size?: 'sm' | 'md' | 'lg';
  tone?: 'light' | 'dark';
  className?: string;
  decorative?: boolean;
}

const SIZE_CLASSES = {
  sm: 'h-9 w-9 rounded-xl',
  md: 'h-12 w-12 rounded-2xl',
  lg: 'h-16 w-16 rounded-[1.4rem]',
} as const;

const DREAMKEY_BRAND_ASSET = '/brand/dreamkey-brand.png';

export function DreamKeyMark({
  variant = 'compact',
  size = 'md',
  tone = 'dark',
  className,
  decorative = true,
}: DreamKeyMarkProps) {
  const alt = decorative ? '' : 'DREAMKey brand artwork: a green compass-topped key';

  if (variant === 'brand') {
    return (
      <span className={cn('block overflow-hidden', className)}>
        <img
          src={DREAMKEY_BRAND_ASSET}
          width={1536}
          height={1024}
          alt={alt}
          className="block h-auto w-full object-contain"
        />
      </span>
    );
  }

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 overflow-hidden border bg-black shadow-md',
        tone === 'light'
          ? 'border-white/15 shadow-black/20'
          : 'border-emerald-800/20 shadow-emerald-950/10 dark:border-emerald-400/20 dark:shadow-black/30',
        SIZE_CLASSES[size],
        className,
      )}
    >
      {/* TODO: Prefer a dedicated approved transparent compact asset if the brand owner supplies one. */}
      <img
        src={DREAMKEY_BRAND_ASSET}
        width={1536}
        height={1024}
        alt={alt}
        className="absolute left-1/2 top-0 h-auto w-[333%] max-w-none -translate-x-1/2"
      />
    </span>
  );
}
