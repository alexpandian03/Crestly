import React from 'react';
import { Menu } from 'lucide-react';
import { Button } from '../ui/button';
import UserMenu from './UserMenu';

export default function TopBar({ title = 'Brandframe', onToggleMenu, onPassword }) {
  return (
    <header className="h-[56px] shrink-0 border-b border-[#E5E7EB] bg-white px-4 sm:px-6 flex items-center justify-between">
      {/* Left: mobile hamburger button + page title */}
      <div className="flex items-center gap-3 min-w-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleMenu}
          aria-label="Open menu"
          className="lg:hidden h-8 w-8 text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] shrink-0 -ml-1"
        >
          <Menu className="h-4 w-4" />
        </Button>
        <h1 className="text-[16px] sm:text-[18px] font-semibold text-[#111827] truncate leading-none">
          {title}
        </h1>
      </div>

      {/* Right: user menu */}
      <div className="flex items-center shrink-0">
        <UserMenu onPassword={onPassword} />
      </div>
    </header>
  );
}
