import React from 'react';
import { APP_NAME } from '../config/brand';

function Mark({ size = 36 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="40" height="40" rx="10" fill="var(--color-primary)" />
      <rect x="9" y="6" width="22" height="28" rx="2.5" fill="var(--color-canvas)" />
      <rect x="9" y="6" width="22" height="5.5" fill="var(--color-heading)" />
      <rect x="9" y="28.5" width="22" height="5.5" fill="var(--color-heading)" />
      <path
        d="M20 13.2 L21.35 18.05 L26.4 19.5 L21.35 20.95 L20 25.8 L18.65 20.95 L13.6 19.5 L18.65 18.05 Z"
        fill="var(--color-accent)"
      />
    </svg>
  );
}

export default function Logo({ variant = 'full', className = '' }) {
  if (variant === 'icon') {
    return (
      <span className={`inline-flex ${className}`}>
        <Mark />
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Mark />
      <span className="text-lg font-semibold tracking-tight text-primary">
        Brandframe
        <span className="sr-only">{APP_NAME}</span>
      </span>
    </span>
  );
}
