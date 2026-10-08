import React from 'react';
import { APP_NAME } from '../config/brand';

function Mark({ size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect x="3.5" y="2" width="17" height="20" rx="3" stroke="#111827" strokeWidth="1.75" />
      <line x1="3.5" y1="6.5" x2="20.5" y2="6.5" stroke="#111827" strokeWidth="1.5" />
      <line x1="3.5" y1="17.5" x2="20.5" y2="17.5" stroke="#111827" strokeWidth="1.5" />
      <path
        d="M12 9.2 L12.65 11.35 L14.8 12 L12.65 12.65 L12 14.8 L11.35 12.65 L9.2 12 L11.35 11.35 Z"
        fill="#2563EB"
      />
    </svg>
  );
}

export default function Logo({ variant = 'full', className = '' }) {
  if (variant === 'icon') {
    return (
      <span className={`inline-flex items-center ${className}`}>
        <Mark size={20} />
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Mark size={20} />
      <span className="text-[16px] font-semibold text-[#111827] tracking-tight">
        Brandframe
        <span className="sr-only">{APP_NAME}</span>
      </span>
    </span>
  );
}
