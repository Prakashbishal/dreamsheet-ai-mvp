import { useState } from 'react';

type BrandMarkVariant = 'full' | 'compact';
type BrandMarkTone = 'light' | 'dark';
type BrandMarkSize = 'sm' | 'md' | 'lg' | 'xl';

interface BrandMarkProps {
  variant?: BrandMarkVariant;
  tone?: BrandMarkTone;
  size?: BrandMarkSize;
  className?: string;
}

const MARK_PIXELS: Record<BrandMarkSize, number> = {
  sm: 30,
  md: 40,
  lg: 50,
  xl: 62,
};

const WORDMARK_CLASSES: Record<BrandMarkSize, string> = {
  sm: 'text-base',
  md: 'text-xl',
  lg: 'text-2xl sm:text-[1.7rem]',
  xl: 'text-3xl sm:text-4xl',
};

export function BrandMark({ variant = 'full', tone = 'dark', size = 'md', className = '' }: BrandMarkProps) {
  const [imageAvailable, setImageAvailable] = useState(true);
  const pixels = MARK_PIXELS[size];
  const textColour = tone === 'light' ? 'text-white' : 'text-stone-950';

  return (
    <div
      aria-label="DREAMSheet AI"
      className={`inline-flex shrink-0 items-center gap-2.5 ${textColour} ${className}`}
      role="img"
    >
      {imageAvailable ? (
        <span
          aria-hidden="true"
          className="relative block shrink-0 overflow-hidden"
          style={{ height: pixels, width: Math.round(pixels * 0.52) }}
        >
          <img
            alt=""
            className="absolute left-0 top-0 max-w-none"
            height={pixels}
            onError={() => setImageAvailable(false)}
            src="/flourish-logo.png"
            style={{ height: pixels, transform: `translateX(-${Math.round(pixels * 0.34)}px)`, width: 'auto' }}
          />
        </span>
      ) : null}
      {variant === 'full' ? (
        <span className={`${WORDMARK_CLASSES[size]} whitespace-nowrap font-semibold leading-none tracking-[-0.045em]`}>
          <span className="font-bold">DREAM</span><span className="font-normal">Sheet</span><span className="ml-1.5 font-light text-emerald-500">AI</span>
        </span>
      ) : null}
    </div>
  );
}
