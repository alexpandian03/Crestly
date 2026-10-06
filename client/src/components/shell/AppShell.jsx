import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Navbar from '../Navbar';
import Footer from '../Footer';
import SideBar, { MobileMenu } from './SideBar';
import { OrgBar, OrgPicker } from './OrgBar';
import ChangePasswordDialog from './ChangePasswordDialog';
import { useClientOptions } from './useClientOptions';
import {
  guestNavItems,
  hasSidebar,
  memberNavItems,
  navGroups,
  readCollapsed,
  writeCollapsed,
} from './navItems';

/* Must match the h-16 top bar and h-11 context bar: the sidebar sticks below them. */
const TOP_BAR_H = 64;
const ORG_BAR_H = 44;

export default function AppShell({ children }) {
  const { user, isAuthenticated, activeClientId } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const sidebar = isAuthenticated && hasSidebar(user);
  const showOrgBar = isAuthenticated && user?.role === 'superadmin';
  const org = useClientOptions(showOrgBar);

  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawer, setDrawer] = useState(false);
  const [picker, setPicker] = useState(false);
  const [password, setPassword] = useState(false);

  const mustChangePassword = Boolean(user?.mustChangePassword);
  const headerH = TOP_BAR_H + (showOrgBar ? ORG_BAR_H : 0);

  useEffect(() => setDrawer(false), [location.pathname, location.hash]);

  useEffect(() => {
    if (mustChangePassword) setPassword(true);
  }, [mustChangePassword]);

  useEffect(() => {
    if (!drawer) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setDrawer(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [drawer]);

  const toggleCollapsed = () =>
    setCollapsed((value) => {
      writeCollapsed(!value);
      return !value;
    });

  const askForClient = () => {
    org.reload();
    setPicker(true);
  };

  const groups = sidebar ? navGroups(user) : null;
  const flatItems = !isAuthenticated ? guestNavItems : memberNavItems;

  return (
    <div className="flex min-h-screen flex-col bg-canvas font-sans text-body">
      <div className="sticky top-0 z-40 shrink-0 bg-canvas">
        <Navbar menuOpen={drawer} onToggleMenu={() => setDrawer((value) => !value)} onPassword={() => setPassword(true)} />
        {showOrgBar && <OrgBar selected={org.selected} onChange={askForClient} />}
      </div>

      <div className="flex w-full flex-1 items-stretch">
        {sidebar && (
          <SideBar
            collapsed={collapsed}
            onToggle={toggleCollapsed}
            groups={groups}
            hasClient={Boolean(activeClientId)}
            onNeedClient={askForClient}
            style={{ top: headerH, height: `calc(100vh - ${headerH}px)` }}
          />
        )}
        <main className="min-w-0 flex-1">{children}</main>
      </div>

      {!sidebar && <Footer />}

      <MobileMenu
        open={drawer}
        onClose={() => setDrawer(false)}
        hiddenClass={sidebar ? 'lg:hidden' : 'md:hidden'}
        groups={groups}
        flatItems={flatItems}
        hasClient={Boolean(activeClientId)}
        onNeedClient={askForClient}
      />

      {showOrgBar && (
        <OrgPicker
          open={picker}
          clients={org.clients}
          currentId={activeClientId}
          loading={org.loading}
          onClose={() => setPicker(false)}
          onPick={org.select}
        />
      )}

      <ChangePasswordDialog
        open={password || mustChangePassword}
        mustChange={mustChangePassword}
        onClose={() => setPassword(false)}
        onSignedOut={() => navigate('/login')}
      />
    </div>
  );
}
