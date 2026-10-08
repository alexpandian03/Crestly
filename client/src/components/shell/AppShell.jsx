import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Navbar from '../Navbar';
import Footer from '../Footer';
import SideBar, { MobileMenu } from './SideBar';
import TopBar from './TopBar';
import { OrgBar, OrgPicker } from './OrgBar';
import ChangePasswordDialog from './ChangePasswordDialog';
import { useClientOptions } from './useClientOptions';
import {
  guestNavItems,
  hasSidebar,
  memberNavItems,
  navGroups,
  readCollapsed,
  titleForPath,
  writeCollapsed,
} from './navItems';

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
  const title = titleForPath(location.pathname);

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
    <div className="flex min-h-screen bg-white font-sans text-[#111827]">
      {/* 240px wide sidebar on the left for authenticated users */}
      {sidebar && (
        <SideBar
          collapsed={collapsed}
          onToggle={toggleCollapsed}
          groups={groups}
          hasClient={Boolean(activeClientId)}
          onNeedClient={askForClient}
        />
      )}

      {/* Main content column with 56px top bar */}
      <div className="flex flex-1 flex-col min-w-0">
        {sidebar ? (
          <div className="sticky top-0 z-40 bg-white">
            <TopBar
              title={title}
              onToggleMenu={() => setDrawer((value) => !value)}
              onPassword={() => setPassword(true)}
            />
            {showOrgBar && <OrgBar selected={org.selected} onChange={askForClient} />}
          </div>
        ) : (
          <div className="sticky top-0 z-40 bg-white">
            <Navbar
              menuOpen={drawer}
              onToggleMenu={() => setDrawer((value) => !value)}
              onPassword={() => setPassword(true)}
            />
            {showOrgBar && <OrgBar selected={org.selected} onChange={askForClient} />}
          </div>
        )}

        <main className="min-w-0 flex-1">{children}</main>

        {!sidebar && <Footer />}
      </div>

      {/* Mobile drawer for small screens */}
      <MobileMenu
        open={drawer}
        onClose={() => setDrawer(false)}
        groups={groups}
        hasClient={Boolean(activeClientId)}
        onNeedClient={askForClient}
      />

      {/* Superadmin organization picker */}
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

      {/* Password change dialog */}
      <ChangePasswordDialog
        open={password || mustChangePassword}
        mustChange={mustChangePassword}
        onClose={() => setPassword(false)}
        onSignedOut={() => navigate('/login')}
      />
    </div>
  );
}
