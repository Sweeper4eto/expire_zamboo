type SvgProps = { className?: string };

export function ArtCartonBox({ className = "h-full w-full" }: SvgProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden>
      <path d="M10 22l22-10 22 10v28l-22 10L10 50V22z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M32 12v20M10 22l22 10 22-10" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M22 28v16M42 28v16" stroke="currentColor" strokeWidth="1.5" opacity="0.45" />
      <path d="M26 18h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}

export function ArtBottle({ className = "h-full w-full" }: SvgProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden>
      <path d="M26 8h12v6c0 2-2 3-2 5l-1 4h-6l-1-4c0-2-2-3-2-5V8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <rect x="22" y="23" width="20" height="32" rx="4" stroke="currentColor" strokeWidth="2" />
      <path d="M24 34h16M24 40h16" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <rect x="24" y="28" width="16" height="4" rx="1" fill="currentColor" opacity="0.2" />
    </svg>
  );
}

export function ArtJar({ className = "h-full w-full" }: SvgProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden>
      <rect x="18" y="24" width="28" height="30" rx="6" stroke="currentColor" strokeWidth="2" />
      <path d="M22 24v-4c0-2 2-4 4-4h12c2 0 4 2 4 4v4" stroke="currentColor" strokeWidth="2" />
      <ellipse cx="32" cy="38" rx="10" ry="8" stroke="currentColor" strokeWidth="1.5" opacity="0.45" />
      <path d="M24 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="32" cy="38" r="3" fill="currentColor" opacity="0.25" />
    </svg>
  );
}

export function ArtCan({ className = "h-full w-full" }: SvgProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden>
      <rect x="22" y="14" width="20" height="38" rx="4" stroke="currentColor" strokeWidth="2" />
      <path d="M22 20h20M22 46h20" stroke="currentColor" strokeWidth="2" />
      <ellipse cx="32" cy="14" rx="10" ry="3" stroke="currentColor" strokeWidth="2" />
      <ellipse cx="32" cy="52" rx="10" ry="3" stroke="currentColor" strokeWidth="2" />
      <path d="M28 28h8v10h-8z" stroke="currentColor" strokeWidth="1.5" opacity="0.45" />
    </svg>
  );
}

export function ArtPaperBag({ className = "h-full w-full" }: SvgProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden>
      <path d="M16 24l6-10h20l6 10v28H16V24z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M24 14c0 4 16 4 16 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M22 34h20M22 42h14" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
    </svg>
  );
}

export function ArtShelfTrio({ className = "h-full w-full" }: SvgProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden>
      <path d="M8 46h48" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <rect x="12" y="22" width="12" height="24" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <rect x="26" y="18" width="12" height="28" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M44 26h8v20h-8z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <path d="M46 22h4v4h-4z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M16 30h4M30 26h4" stroke="currentColor" strokeWidth="1.25" opacity="0.4" />
    </svg>
  );
}

export function ArtBarcodeProduct({ className = "h-full w-full" }: SvgProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden>
      <rect x="16" y="12" width="32" height="34" rx="4" stroke="currentColor" strokeWidth="2" />
      <path d="M22 20h20M22 26h14M22 32h18" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <rect x="18" y="48" width="28" height="8" rx="2" fill="currentColor" opacity="0.12" stroke="currentColor" strokeWidth="1.5" />
      {Array.from({ length: 10 }).map((_, i) => (
        <rect key={i} x={20 + i * 2.4} y="50" width="1.2" height="4" fill="currentColor" opacity="0.55" />
      ))}
    </svg>
  );
}

export function ArtCrate({ className = "h-full w-full" }: SvgProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden>
      <path d="M10 28l22-8 22 8v22l-22 8-22-8V28z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M32 20v30M10 28l22 8 22-8" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <rect x="22" y="32" width="8" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      <rect x="34" y="34" width="8" height="8" rx="4" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
    </svg>
  );
}

export function ArtTube({ className = "h-full w-full" }: SvgProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden>
      <rect x="20" y="18" width="24" height="34" rx="8" stroke="currentColor" strokeWidth="2" />
      <path d="M24 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M26 30h12M26 36h12M26 42h8" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <circle cx="32" cy="24" r="2" fill="currentColor" opacity="0.3" />
    </svg>
  );
}

export function ArtGroceryStillLife({ className = "h-full w-full" }: SvgProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden>
      <rect x="10" y="28" width="18" height="20" rx="3" stroke="currentColor" strokeWidth="1.75" />
      <path d="M14 28v-6c0-2 3-4 5-4h4c2 0 5 2 5 4v6" stroke="currentColor" strokeWidth="1.75" />
      <rect x="34" y="22" width="14" height="26" rx="3" stroke="currentColor" strokeWidth="1.75" />
      <path d="M36 22v-5h10v5" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8 50h48" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.35" />
      <ellipse cx="19" cy="36" rx="4" ry="3" fill="currentColor" opacity="0.18" />
      <path d="M38 30h6M38 36h6" stroke="currentColor" strokeWidth="1.25" opacity="0.35" />
    </svg>
  );
}
