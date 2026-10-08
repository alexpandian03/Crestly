import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import Logo from '../Logo';
import { Button } from '../ui/button';
import { cn } from 'cn';

const BASE_ITEM =
  'relative flex items-center gap-2.5 rounded-[6px] px-3 py-2 text-[14px] font-normal whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#E5E7EB]';

function itemClass({ isActive }) {
  return cn(
    BASE_ITEM,
    isActive
      ? 'bg-[#F3F4F6] text-[#111827] font-medium'
      : 'text-[#374151] hover:bg-[#F3F4F6] hover:text-[#111827]'
  );
}

/** One nav row: a link when accessible, or button requesting tenant selection. */
function NavRow({ item, collapsed, disabled, onDisabled, onNavigate }) {
  const Icon = item.icon;
  const label = (
    <>
      {Icon && <Icon className="h-4 w-4 shrink-0 text-[#6B7280]" />}
      {!collapsed && <span className="truncate leading-none">{item.label}</span>}
    </>
  );

  if (disabled) {
    return (
      <button
        type="button"
        onClick={onDisabled}
        aria-disabled="true"
        title="Select an organization first"
        className={cn(
          BASE_ITEM,
          'w-full cursor-not-allowed text-[#9CA3AF] hover:bg-transparent',
          collapsed && 'justify-center px-2'
        )}
      >
        {label}
      </button>
    );
  }

  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        cn(itemClass({ isActive }), collapsed && 'justify-center px-2')
      }
      title={collapsed ? item.label : undefined}
      onClick={onNavigate}
    >
      {label}
    </NavLink>
  );
}

export function NavList({
  groups = [],
  collapsed = false,
  hasClient = false,
  onNeedClient,
  onNavigate,
}) {
  return (
    <nav className="flex flex-col gap-1" aria-label="Sidebar navigation">
      {groups.map((group, groupIdx) => (
        <div key={groupIdx} className="flex flex-col gap-0.5">
          {group.items.map((item) => (
            <NavRow
              key={item.to}
              item={item}
              collapsed={collapsed}
              disabled={Boolean(group.needsClient) && !hasClient}
              onDisabled={onNeedClient}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ))}
    </nav>
  );
}

export default function SideBar({
  collapsed,
  onToggle,
  groups,
  hasClient,
  onNeedClient,
}) {
  return (
    <aside
      className={cn(
        'sticky top-0 h-screen z-30 hidden min-w-0 shrink-0 flex-col overflow-hidden border-r border-[#E5E7EB] bg-[#FAFAFA] transition-[width] duration-150 lg:flex',
        collapsed ? 'w-[64px]' : 'w-[240px]'
      )}
    >
      {/* Logo + "Brandframe" at top (small, 16px/600, no colored box around the logo) */}
      <div
        className={cn(
          'h-[56px] flex items-center border-b border-[#E5E7EB] shrink-0',
          collapsed ? 'justify-center px-2' : 'px-4'
        )}
      >
        <Link to="/" className="flex items-center">
          <Logo variant={collapsed ? 'icon' : 'full'} />
        </Link>
      </div>

      {/* Nav items (no WORKSPACE label, 16px gray icons, 14px text) */}
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <NavList
          groups={groups}
          collapsed={collapsed}
          hasClient={hasClient}
          onNeedClient={onNeedClient}
        />
      </div>

      {/* Collapse button at the bottom stays, styled as a ghost button */}
      <div className="p-2 border-t border-[#E5E7EB] shrink-0">
        <Button
          variant="ghost"
          onClick={onToggle}
          className={cn(
            'w-full text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] rounded-[6px] h-9 text-[13px] font-normal transition-colors',
            collapsed ? 'justify-center px-0' : 'justify-start gap-2.5 px-3'
          )}
          title={collapsed ? 'Expand menu' : 'Collapse menu'}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4 shrink-0 text-[#6B7280]" />
          ) : (
            <PanelLeftClose className="h-4 w-4 shrink-0 text-[#6B7280]" />
          )}
          {!collapsed && <span>Collapse</span>}
        </Button>
      </div>
    </aside>
  );
}

/** Off-canvas mobile menu for small screens */
export function MobileMenu({
  open,
  onClose,
  groups,
  hasClient,
  onNeedClient,
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div
        className="absolute inset-0 bg-[#111827]/40 backdrop-blur-xs transition-opacity"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        className="absolute inset-y-0 left-0 flex w-[240px] max-w-[85%] flex-col border-r border-[#E5E7EB] bg-[#FAFAFA] shadow-md"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <div className="flex h-[56px] shrink-0 items-center justify-between border-b border-[#E5E7EB] px-4">
          <Link to="/" onClick={onClose} className="flex items-center">
            <Logo variant="full" />
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close menu"
            className="h-8 w-8 rounded-[6px] text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6]"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <NavList
            groups={groups}
            collapsed={false}
            hasClient={hasClient}
            onNeedClient={onNeedClient}
            onNavigate={onClose}
          />
        </div>
      </div>
    </div>
  );
}
