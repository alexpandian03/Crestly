import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, KeyRound, LogOut, Menu, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import Logo from './Logo';

const guestLinks = [
  { to: '/#templates', label: 'Templates' },
  { to: '/#how-it-works', label: 'How it works' },
  { to: '/#pricing', label: 'Pricing' },
];

function linksFor(user, activeClientId) {
  if (user?.role === 'superadmin') {
    const links = [
      { to: '/dashboard', label: 'Dashboard' },
      { to: '/clients', label: 'Organizations' },
      { to: '/users', label: 'Users' },
    ];
    if (activeClientId) {
      links.push(
        { to: '/create', label: 'Create' },
        { to: '/posters', label: 'Posters' },
        { to: '/brand-kit', label: 'Brand kit' },
        { to: '/templates', label: 'Templates' }
      );
    }
    return links;
  }
  if (user?.role === 'clientadmin') {
    return [
      { to: '/dashboard', label: 'Dashboard' },
      { to: '/create', label: 'Create' },
      { to: '/posters', label: 'Posters' },
      { to: '/brand-kit', label: 'Brand kit' },
      { to: '/templates', label: 'Templates' },
      { to: '/team', label: 'Team' },
    ];
  }
  return [
    { to: '/create', label: 'Create' },
    { to: '/posters', label: 'Posters' },
  ];
}

function homeForRole(role) {
  if (role === 'superadmin') return '/clients';
  if (role === 'clientadmin') return '/dashboard';
  return '/create';
}

const navLinkClass = ({ isActive }) =>
  `px-3 py-2 rounded-btn text-sm font-medium transition-colors ${
    isActive ? 'bg-section text-heading' : 'text-body hover:text-heading hover:bg-section'
  }`;

export default function Navbar() {
  const {
    user,
    isAuthenticated,
    activeClientId,
    selectActiveClient,
    refreshUser,
    logout,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const menuRef = useRef(null);
  const [drawer, setDrawer] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [clients, setClients] = useState([]);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const mustChangePassword = Boolean(user?.mustChangePassword);

  useEffect(() => {
    setDrawer(false);
    setMenuOpen(false);
  }, [location.pathname, location.hash]);

  useEffect(() => {
    if (mustChangePassword) setPasswordOpen(true);
  }, [mustChangePassword]);

  useEffect(() => {
    const onDocumentClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocumentClick);
    return () => document.removeEventListener('mousedown', onDocumentClick);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'superadmin') {
      setClients([]);
      return;
    }

    let active = true;
    api.get('/clients')
      .then((response) => {
        if (!active) return;
        const nextClients = response.data?.data?.clients || [];
        setClients(nextClients);
        if (activeClientId && !nextClients.some((client) => (client.id || client._id) === activeClientId && client.isActive !== false)) {
          selectActiveClient('');
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [activeClientId, isAuthenticated, selectActiveClient, user?.role]);

  const closePasswordForm = () => {
    if (mustChangePassword) return;
    setPasswordOpen(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
  };

  const handleLogout = () => {
    logout();
    setDrawer(false);
    setMenuOpen(false);
    setPasswordOpen(false);
    navigate('/login');
  };

  const handlePasswordChange = async (event) => {
    event.preventDefault();
    setPasswordError('');
    if (newPassword.length < 10 || newPassword.length > 72 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setPasswordError('Use 10–72 characters with at least one letter and one number.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('The new passwords do not match.');
      return;
    }

    try {
      setChangingPassword(true);
      await api.post('/auth/change-password', { currentPassword, newPassword });
      await refreshUser();
      setPasswordOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password changed.');
    } catch (err) {
      setPasswordError(err.response?.data?.error?.message || 'We could not change your password.');
    } finally {
      setChangingPassword(false);
    }
  };

  const links = isAuthenticated ? linksFor(user, activeClientId) : guestLinks;
  const selectedClient = clients.find((client) => (client.id || client._id) === activeClientId);

  return (
    <>
      <header className="sticky top-0 z-40 bg-canvas border-b border-line">
        <div className="container-page min-h-16 flex items-center gap-4 py-2">
          <Link to={isAuthenticated ? homeForRole(user?.role) : '/'} className="shrink-0 rounded-btn">
            <Logo variant="full" />
          </Link>

          <nav className="hidden lg:flex flex-1 items-center justify-center gap-1" aria-label="Primary">
            {isAuthenticated
              ? links.map((link) => <NavLink key={link.to} to={link.to} className={navLinkClass}>{link.label}</NavLink>)
              : guestLinks.map((link) => <a key={link.to} href={link.to} className="px-3 py-2 rounded-btn text-sm font-medium text-body hover:text-heading hover:bg-section">{link.label}</a>)}
          </nav>

          <div className="ml-auto hidden md:flex items-center gap-2">
            {isAuthenticated && user?.role === 'superadmin' && (
              <label className="flex items-center gap-2 text-xs font-medium text-muted">
                <span className="whitespace-nowrap">Working as:</span>
                <select
                  value={activeClientId}
                  onChange={(event) => selectActiveClient(event.target.value)}
                  className="max-w-44 bg-canvas border border-line rounded-btn px-2.5 py-2 text-sm text-heading focus:outline-none focus:border-primary"
                  aria-label="Working organization"
                >
                  <option value="">Select organization</option>
                  {clients.map((client) => (
                    <option key={client.id || client._id} value={client.id || client._id} disabled={client.isActive === false}>{client.name}{client.isActive === false ? ' (inactive)' : ''}</option>
                  ))}
                </select>
              </label>
            )}

            {isAuthenticated ? (
              <div className="relative" ref={menuRef}>
                <button type="button" onClick={() => setMenuOpen((open) => !open)} className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-btn border border-line text-sm font-medium text-heading" aria-expanded={menuOpen} aria-haspopup="menu">
                  <span className="max-w-32 truncate">{user?.name}</span>
                  <span className="rounded-chip bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">{user?.role}</span>
                  <ChevronDown className="w-4 h-4 text-muted" />
                </button>
                {menuOpen && (
                  <div role="menu" className="absolute right-0 mt-2 w-52 rounded-card border border-line bg-canvas shadow-soft py-1">
                    <button type="button" role="menuitem" onClick={() => { setPasswordOpen(true); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-body hover:bg-section">
                      <KeyRound className="w-4 h-4" /> Change password
                    </button>
                    <button type="button" role="menuitem" onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-body hover:bg-section">
                      <LogOut className="w-4 h-4" /> Log out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/login" className="btn-primary">Log in</Link>
            )}
          </div>

          <button type="button" onClick={() => setDrawer((open) => !open)} className="md:hidden ml-auto p-2 rounded-btn border border-line text-heading" aria-label={drawer ? 'Close menu' : 'Open menu'} aria-expanded={drawer}>
            {drawer ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {drawer && (
          <div className="md:hidden border-t border-line bg-canvas px-4 py-4 space-y-2">
            {isAuthenticated && user?.role === 'superadmin' && (
              <label className="block text-xs font-medium text-muted pb-2">
                Working as:
                <select value={activeClientId} onChange={(event) => selectActiveClient(event.target.value)} className="input-field mt-1">
                  <option value="">Select organization</option>
                  {clients.map((client) => <option key={client.id || client._id} value={client.id || client._id} disabled={client.isActive === false}>{client.name}{client.isActive === false ? ' (inactive)' : ''}</option>)}
                </select>
              </label>
            )}
            {isAuthenticated ? links.map((link) => <NavLink key={link.to} to={link.to} className={({ isActive }) => `${navLinkClass({ isActive })} block`}>{link.label}</NavLink>) : guestLinks.map((link) => <a key={link.to} href={link.to} className="block px-3 py-2 rounded-btn text-sm font-medium text-body">{link.label}</a>)}
            {isAuthenticated ? (
              <div className="pt-3 mt-3 border-t border-line space-y-1">
                <p className="px-3 text-sm font-medium text-heading">{user?.name} <span className="ml-1 text-xs uppercase text-primary">{user?.role}</span></p>
                {selectedClient && <p className="px-3 text-xs text-muted">Working as {selectedClient.name}</p>}
                <button type="button" onClick={() => setPasswordOpen(true)} className="w-full text-left px-3 py-2 rounded-btn text-sm text-body">Change password</button>
                <button type="button" onClick={handleLogout} className="w-full text-left px-3 py-2 rounded-btn text-sm text-body">Log out</button>
              </div>
            ) : <Link to="/login" className="btn-primary w-full">Log in</Link>}
          </div>
        )}
      </header>

      {isAuthenticated && (passwordOpen || mustChangePassword) && (
        <div className="fixed inset-0 z-[60] bg-heading/40 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="change-password-title">
          <div className="w-full max-w-md card-surface p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="change-password-title" className="text-lg">Change password</h2>
                <p className="text-sm text-muted mt-1">Use 10–72 characters with a letter and a number.</p>
              </div>
              {!mustChangePassword && <button type="button" onClick={closePasswordForm} className="text-muted hover:text-heading" aria-label="Close"><X className="w-5 h-5" /></button>}
            </div>
            {mustChangePassword && <div className="rounded-card border border-primary/20 bg-primary/5 p-3 text-sm text-heading">You must change your temporary password before continuing.</div>}
            {passwordError && <div className="rounded-card border border-danger/30 bg-danger/5 p-3 text-sm text-danger" role="alert">{passwordError}</div>}
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-heading mb-1.5">Current password</label>
                <input type="password" required autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-heading mb-1.5">New password</label>
                <input type="password" required minLength={10} maxLength={72} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-heading mb-1.5">Confirm new password</label>
                <input type="password" required minLength={10} maxLength={72} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="input-field" />
              </div>
              <div className="flex justify-end gap-2">
                {mustChangePassword ? <button type="button" onClick={handleLogout} className="btn-ghost">Log out</button> : <button type="button" onClick={closePasswordForm} className="btn-ghost">Cancel</button>}
                <button type="submit" disabled={changingPassword} className="btn-primary">{changingPassword ? 'Changing…' : 'Change password'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
