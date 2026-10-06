import React from "react";
import { NavLink } from "react-router-dom";
import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import Logo from "../Logo";

const BASE =
  "relative flex items-center gap-3 rounded-btn px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-offset-[-2px]";

function itemClass({ isActive }) {
  return `${BASE} ${
    isActive
      ? "bg-primary/10 text-primary font-semibold"
      : "text-body hover:bg-section hover:text-heading"
  }`;
}

function ActiveBar() {
  return (
    <span
      aria-hidden="true"
      className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary"
    />
  );
}

/** One nav row: a link when it can be opened, otherwise a button that asks for an organization. */
function NavRow({ item, collapsed, disabled, onDisabled, onNavigate }) {
  const Icon = item.icon;
  const label = (
    <>
      {Icon && <Icon className="h-[18px] w-[18px] shrink-0" />}
      {!collapsed && <span className="truncate">{item.label}</span>}
    </>
  );

  if (disabled) {
    return (
      <button
        type="button"
        onClick={onDisabled}
        aria-disabled="true"
        title="Select an organization first"
        className={`${BASE} w-full cursor-not-allowed text-muted-foreground/70 hover:bg-transparent`}
      >
        {label}
      </button>
    );
  }

  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        `${itemClass({ isActive })} ${collapsed ? "justify-center px-2" : ""}`
      }
      title={collapsed ? item.label : undefined}
      onClick={onNavigate}
    >
      {({ isActive }) => (
        <>
          {isActive && <ActiveBar />}
          {label}
        </>
      )}
    </NavLink>
  );
}

export function NavList({
  groups,
  collapsed,
  hasClient,
  onNeedClient,
  onNavigate,
}) {
  return (
    <nav className="flex flex-col gap-5 px-3 py-4" aria-label="Sections">
      {groups.map((group) => (
        <div key={group.label} className="space-y-1">
          {!collapsed && (
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </p>
          )}
          {collapsed && <div className="mx-3 border-t border-line" />}
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
  style,
}) {
  return (
    <aside
      className={`sticky z-30 hidden min-w-0 shrink-0 flex-col overflow-hidden border-r border-line bg-canvas transition-[width] duration-150 lg:flex ${collapsed ? "w-[68px]" : "w-60"}`}
      style={style}
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        <NavList
          groups={groups}
          collapsed={collapsed}
          hasClient={hasClient}
          onNeedClient={onNeedClient}
        />
      </div>
      <div className="border-t border-line p-3">
        <button
          type="button"
          onClick={onToggle}
          title={collapsed ? "Show menu labels" : "Hide menu labels"}
          className="flex w-full items-center gap-3 rounded-btn px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-section hover:text-heading"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-[18px] w-[18px] shrink-0" />
          ) : (
            <PanelLeftClose className="h-[18px] w-[18px] shrink-0" />
          )}
          {!collapsed && <span>Collapse menu</span>}
        </button>
      </div>
    </aside>
  );
}

/** Off-canvas version of the same menu, opened by the hamburger on small screens. */
export function MobileMenu({
  open,
  onClose,
  hiddenClass = "lg:hidden",
  groups,
  flatItems,
  hasClient,
  onNeedClient,
}) {
  if (!open) return null;
  return (
    <div className={`fixed inset-0 z-50 ${hiddenClass}`}>
      <div
        className="absolute inset-0 bg-heading/60"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        className="absolute inset-y-0 left-0 flex w-64 max-w-[85%] flex-col border-r border-line bg-canvas shadow-soft"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
      >
        <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-line px-4">
          <Logo variant="full" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="rounded-btn border border-line p-2 text-heading hover:bg-section"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {groups ? (
            <NavList
              groups={groups}
              collapsed={false}
              hasClient={hasClient}
              onNeedClient={onNeedClient}
              onNavigate={onClose}
            />
          ) : (
            <nav className="flex flex-col gap-1 px-3 py-4" aria-label="Primary">
              {flatItems.map((item) =>
                item.href ? (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={`${BASE} text-body hover:bg-section hover:text-heading`}
                  >
                    {item.label}
                  </a>
                ) : (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={itemClass}
                    onClick={onClose}
                  >
                    {item.label}
                  </NavLink>
                ),
              )}
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
