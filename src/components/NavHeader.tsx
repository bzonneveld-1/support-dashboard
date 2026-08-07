'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

interface NavHeaderProps {
  rightContent?: React.ReactNode;
}

export default function NavHeader({ rightContent }: NavHeaderProps) {
  const pathname = usePathname();
  const [tvSuffix, setTvSuffix] = useState('');

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('tv') || document.documentElement.hasAttribute('data-tv')) {
      setTvSuffix('?tv=1');
    }
  }, []);

  return (
    <div
      className="nav-header grid items-center mb-4 flex-shrink-0 gap-3"
      style={{ gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)' }}
    >
      <div className="flex items-center gap-4 min-w-0">
        <h1 className="text-sm font-semibold text-[var(--dash-text)] tracking-tight whitespace-nowrap">
          Support Dashboard
        </h1>
        <div className="flex bg-[var(--dash-border)] rounded-lg p-0.5 flex-shrink-0">
          <Link
            href={`/${tvSuffix}`}
            className={`px-3 py-1 text-[0.6875rem] font-medium rounded-md transition-colors ${
              pathname === '/'
                ? 'bg-[var(--dash-surface)] text-[var(--dash-text)] shadow-sm'
                : 'text-[#8E8E93] hover:text-[var(--dash-text)]'
            }`}
          >
            Table
          </Link>
          <Link
            href={`/charts${tvSuffix}`}
            className={`px-3 py-1 text-[0.6875rem] font-medium rounded-md transition-colors ${
              pathname === '/charts'
                ? 'bg-[var(--dash-surface)] text-[var(--dash-text)] shadow-sm'
                : 'text-[#8E8E93] hover:text-[var(--dash-text)]'
            }`}
          >
            Charts
          </Link>
          <Link
            href={`/target${tvSuffix}`}
            className={`px-3 py-1 text-[0.6875rem] font-medium rounded-md transition-colors ${
              pathname === '/target'
                ? 'bg-[var(--dash-surface)] text-[var(--dash-text)] shadow-sm'
                : 'text-[#8E8E93] hover:text-[var(--dash-text)]'
            }`}
          >
            Target
          </Link>
        </div>
      </div>
      <div className="justify-self-center">
        <img src="/bold-logo.png" alt="Bold" className="nav-logo-dark h-[2rem] w-auto -mt-1" />
        <img src="/bold-logo-white.png" alt="Bold" className="nav-logo-white hidden h-[2rem] w-auto -mt-1" />
      </div>
      <div className="flex items-center gap-3 justify-self-end min-w-0">
        {rightContent}
      </div>
    </div>
  );
}
