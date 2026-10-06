import React from 'react';
import { Link } from 'react-router-dom';
import Logo from './Logo';
import { APP_NAME, APP_TAGLINE } from '../config/brand';

const cols = [
  {
    title: 'Product',
    links: [
      { href: '/#templates', label: 'Templates' },
      { href: '/#how-it-works', label: 'How it works' },
      { href: '/#pricing', label: 'Pricing' },
      { href: '/create', label: 'Create a poster' },
    ],
  },
  {
    title: 'Workspace',
    links: [
      { href: '/dashboard', label: 'Dashboard' },
      { href: '/brand-kit', label: 'Brand kit' },
      { href: '/users', label: 'Team' },
      { href: '/posters', label: 'My posters' },
    ],
  },
  {
    title: 'Account',
    links: [
      { href: '/login', label: 'Log in' },
      { href: '/#faq', label: 'Questions' },
      { href: '/#formats', label: 'File formats' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/#made-for', label: 'Who it is for' },
      { href: '/#brand-lock', label: 'Brand lock' },
      { href: 'mailto:hello@brandframe.example', label: 'Contact' },
      { href: '/#pricing', label: 'Plans' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-line bg-section">
      <div className="container-page section-pad">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2 md:col-span-1">
            <Logo />
            <p className="mt-3 text-sm text-muted max-w-[220px]">{APP_TAGLINE}</p>
          </div>
          {cols.map((col) => (
            <div key={col.title}>
              <h2 className="text-sm font-semibold text-heading mb-3">{col.title}</h2>
              <ul className="space-y-2">
                {col.links.map((l) => (
                  <li key={l.label}>
                    {l.href.startsWith('mailto:') ? (
                      <a className="text-sm text-body hover:text-heading" href={l.href}>
                        {l.label}
                      </a>
                    ) : l.href.startsWith('/#') || l.href.startsWith('/') ? (
                      <Link className="text-sm text-body hover:text-heading" to={l.href}>
                        {l.label}
                      </Link>
                    ) : (
                      <a className="text-sm text-body hover:text-heading" href={l.href}>
                        {l.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-12 pt-6 border-t border-line text-xs text-muted">
          © {new Date().getFullYear()} {APP_NAME}. Brand headers, footers, logos, and colors stay as you set them.
        </p>
      </div>
    </footer>
  );
}
