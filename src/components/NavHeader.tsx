'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

interface NavHeaderProps {
  rightContent?: React.ReactNode;
}

export default function NavHeader({ rightContent }: NavHeaderProps) {
  const pathname = usePathname();

  return (
    <div className="relative flex items-center justify-between mb-4 flex-shrink-0">
      <div className="flex items-center gap-4">
        <h1 className="text-sm font-semibold text-[#1C1C1E] tracking-tight">
          Support Dashboard
        </h1>
        <div className="flex bg-[#E5E5EA] rounded-lg p-0.5">
          <Link
            href="/"
            className={`px-3 py-1 text-[11px] font-medium rounded-md transition-colors ${
              pathname === '/'
                ? 'bg-white text-[#1C1C1E] shadow-sm'
                : 'text-[#8E8E93] hover:text-[#1C1C1E]'
            }`}
          >
            Table
          </Link>
          <Link
            href="/charts"
            className={`px-3 py-1 text-[11px] font-medium rounded-md transition-colors ${
              pathname === '/charts'
                ? 'bg-white text-[#1C1C1E] shadow-sm'
                : 'text-[#8E8E93] hover:text-[#1C1C1E]'
            }`}
          >
            Charts
          </Link>
        </div>
      </div>
      <div className="absolute left-1/2 -translate-x-1/2">
        <Image
          src="/bold-logo.png"
          alt="Bold"
          width={80}
          height={31}
          className="h-8 w-auto -mt-1"
          priority
        />
      </div>
      <div className="flex items-center gap-3">
        {rightContent}
      </div>
    </div>
  );
}
