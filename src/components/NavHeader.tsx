'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

interface NavHeaderProps {
  rightContent?: React.ReactNode;
}

export default function NavHeader({ rightContent }: NavHeaderProps) {
  const pathname = usePathname();

  return (
    <div className="relative flex items-center justify-between mb-4 flex-shrink-0">
      <div className="flex items-center gap-4">
        <h1 className="text-sm font-semibold text-[var(--dash-text)] tracking-tight">
          Support Dashboard
        </h1>
        <div className="flex bg-[var(--dash-border)] rounded-lg p-0.5">
          <Link
            href="/"
            className={`px-3 py-1 text-[0.6875rem] font-medium rounded-md transition-colors ${
              pathname === '/'
                ? 'bg-[var(--dash-surface)] text-[var(--dash-text)] shadow-sm'
                : 'text-[#8E8E93] hover:text-[var(--dash-text)]'
            }`}
          >
            Table
          </Link>
          <Link
            href="/charts"
            className={`px-3 py-1 text-[0.6875rem] font-medium rounded-md transition-colors ${
              pathname === '/charts'
                ? 'bg-[var(--dash-surface)] text-[var(--dash-text)] shadow-sm'
                : 'text-[#8E8E93] hover:text-[var(--dash-text)]'
            }`}
          >
            Charts
          </Link>
        </div>
      </div>
      <div className="absolute left-1/2 -translate-x-1/2">
        <img src="/bold-logo.png" alt="Bold" className="nav-logo-dark h-[2rem] w-auto -mt-1" />
        <img src="/bold-logo-white.png" alt="Bold" className="nav-logo-white hidden h-[2rem] w-auto -mt-1" />
      </div>
      <div className="flex items-center gap-3">
        {rightContent}
      </div>
    </div>
  );
}
