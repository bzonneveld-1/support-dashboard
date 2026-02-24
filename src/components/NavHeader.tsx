'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

interface NavHeaderProps {
  rightContent?: React.ReactNode;
}

export default function NavHeader({ rightContent }: NavHeaderProps) {
  const pathname = usePathname();
  const [isTv, setIsTv] = useState(false);

  useEffect(() => {
    setIsTv(document.documentElement.hasAttribute('data-tv'));
  }, []);

  // On TV, rem values are huge (base 48px), so use fixed px via inline styles
  const tvS = isTv ? {
    wrap: { marginBottom: '12px', gap: '10px' } as React.CSSProperties,
    left: { gap: '10px' } as React.CSSProperties,
    h1: { fontSize: '14px', fontWeight: 600, color: 'var(--dash-text)', letterSpacing: '-0.01em' } as React.CSSProperties,
    pill: { padding: '2px', borderRadius: '6px' } as React.CSSProperties,
    tab: { padding: '4px 10px', fontSize: '11px', fontWeight: 500, borderRadius: '6px' } as React.CSSProperties,
    logo: { height: '32px', marginTop: 0 } as React.CSSProperties,
    right: { gap: '8px' } as React.CSSProperties,
  } : null;

  const tabClass = (active: boolean) => isTv
    ? `transition-colors ${active ? 'bg-[var(--dash-surface)] text-[var(--dash-text)] shadow-sm' : 'text-[#8E8E93]'}`
    : `px-3 py-1 text-[0.6875rem] font-medium rounded-md transition-colors ${active ? 'bg-[var(--dash-surface)] text-[var(--dash-text)] shadow-sm' : 'text-[#8E8E93] hover:text-[var(--dash-text)]'}`;

  return (
    <div
      className={`relative flex items-center justify-between flex-shrink-0 ${isTv ? '' : 'mb-4'}`}
      style={tvS?.wrap}
    >
      <div className={`flex items-center ${isTv ? '' : 'gap-4'}`} style={tvS?.left}>
        <h1
          className={isTv ? '' : 'text-sm font-semibold text-[var(--dash-text)] tracking-tight'}
          style={tvS?.h1}
        >
          Support Dashboard
        </h1>
        <div
          className={`flex bg-[var(--dash-border)] ${isTv ? '' : 'rounded-lg p-0.5'}`}
          style={tvS?.pill}
        >
          <Link href="/" className={tabClass(pathname === '/')} style={tvS?.tab}>
            Table
          </Link>
          <Link href="/charts" className={tabClass(pathname === '/charts')} style={tvS?.tab}>
            Charts
          </Link>
        </div>
      </div>
      <div className="absolute left-1/2 -translate-x-1/2">
        <img src="/bold-logo.png" alt="Bold" className="nav-logo-dark h-[2rem] w-auto -mt-1" style={tvS?.logo} />
        <img src="/bold-logo-white.png" alt="Bold" className="nav-logo-white hidden h-[2rem] w-auto -mt-1" style={tvS?.logo} />
      </div>
      <div className={`flex items-center ${isTv ? '' : 'gap-3'}`} style={tvS?.right}>
        {rightContent}
      </div>
    </div>
  );
}
