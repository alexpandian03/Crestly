import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { saveDraft } from '../config/draft';
import { DEMO_POSTERS, SAMPLE_PROMPTS } from '../data/demoPosters';
import LandingPosterCard from '../components/LandingPosterCard';
import FaqAccordion from '../components/FaqAccordion';
import { FileDown, Lock, RefreshCw, Users } from 'lucide-react';
import { APP_NAME } from '../config/brand';

const CATEGORIES = ['All', 'Event', 'Festival', 'Awareness', 'Achievement', 'Notice'];

const STEPS = [
  { n: '1', title: 'Describe the event', body: 'Name, date, time, and place in everyday words.' },
  { n: '2', title: 'Pick a layout', body: 'Choose a template. Header and footer stay in place.' },
  { n: '3', title: 'Review the middle', body: `${APP_NAME} writes titles and details. Your brand bands do not move.` },
  { n: '4', title: 'Download', body: 'Save PNG, JPG, or PDF from this browser and share.' },
];

const AUDIENCES = [
  { title: 'Clubs', body: 'Meetings, match days, and member notices that still look like you.' },
  { title: 'Schools', body: 'Sports days, parent evenings, and assembly reminders without a design queue.' },
  { title: 'Colleges', body: 'Fest posters and department notices that keep the campus identity intact.' },
  { title: 'Real estate', body: 'Open-house sheets and site notices with locked contacts and colors.' },
  { title: 'Companies', body: 'Internal awards, town halls, and campaign posters on the same brand kit.' },
];

export default function Home() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [text, setText] = useState('');
  const [category, setCategory] = useState('All');

  const posters = useMemo(
    () => (category === 'All' ? DEMO_POSTERS : DEMO_POSTERS.filter((p) => p.category === category)),
    [category]
  );

  const goCreate = (value) => {
    const next = (value ?? text).trim();
    if (next) saveDraft(next);
    if (isAuthenticated) navigate('/create');
    else navigate('/login');
  };

  const onHeroSubmit = (e) => {
    e.preventDefault();
    goCreate(text);
  };

  return (
    <div>
      <section className="bg-section section-pad">
        <div className="container-page text-center max-w-3xl mx-auto">
          <h1 className="text-3xl sm:text-5xl tracking-tight leading-tight">
            Describe your poster. Your brand stays{' '}
            <span className="text-primary relative inline-block">
              fixed
              <span className="absolute left-0 right-0 -bottom-1 h-1 rounded-chip bg-accent" aria-hidden />
            </span>
            .
          </h1>
          <p className="mt-5 text-base sm:text-lg text-body">
            Write the event in a sentence. {APP_NAME} fills the center. Logo, header, footer, and colors stay exactly as your team set them.
          </p>
          <form onSubmit={onHeroSubmit} className="mt-8 text-left">
            <label htmlFor="hero-description" className="sr-only">
              Poster description
            </label>
            <div className="rounded-card bg-canvas border border-primary-ring shadow-soft p-2 sm:p-3 flex flex-col sm:flex-row gap-2">
              <textarea
                id="hero-description"
                rows={3}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Sports day on 18 Oct, 8 AM, school ground…"
                className="flex-1 resize-none border-0 bg-transparent px-3 py-2 text-sm text-heading placeholder:text-muted focus:outline-none focus:ring-0"
              />
              <button type="submit" className="btn-primary sm:self-end shrink-0">
                Generate
              </button>
            </div>
          </form>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {SAMPLE_PROMPTS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setText(p)}
                className="rounded-chip border border-line bg-canvas px-3 py-1.5 text-xs font-medium text-body hover:border-primary hover:text-heading"
              >
                {p.split('.')[0]}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-canvas">
        <div className="container-page py-10 grid sm:grid-cols-3 gap-6 text-center">
          {[
            { title: 'Brand locked', body: 'Header, footer, logo, and colors never follow the copy.' },
            { title: 'PNG, JPG and PDF', body: 'Download in the browser. No extra desktop app.' },
            { title: 'Made for teams', body: 'Admins own the kit. Creators write the event.' },
          ].map((item) => (
            <div key={item.title}>
              <p className="font-semibold text-heading">{item.title}</p>
              <p className="text-sm text-muted mt-1">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="templates" className="section-pad bg-canvas scroll-mt-20">
        <div className="container-page">
          <h2 className="text-2xl sm:text-3xl tracking-tight">Start with a template</h2>
          <p className="mt-2 text-body max-w-2xl">Same brand kit on every layout. Filter by the kind of notice you need.</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`rounded-chip px-3 py-1.5 text-sm font-medium border ${
                  category === c
                    ? 'bg-primary text-white border-primary'
                    : 'bg-canvas text-body border-line hover:border-primary'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {posters.map((poster) => (
              <LandingPosterCard key={poster.id} poster={poster} onUse={(p) => goCreate(p.prompt)} />
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="section-pad bg-section scroll-mt-20">
        <div className="container-page">
          <h2 className="text-2xl sm:text-3xl tracking-tight">How it works</h2>
          <ol className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map((s) => (
              <li key={s.n} className="card-surface p-5">
                <span className="inline-flex w-8 h-8 items-center justify-center rounded-btn bg-primary text-white text-sm font-semibold">
                  {s.n}
                </span>
                <h3 className="mt-4 text-base">{s.title}</h3>
                <p className="mt-2 text-sm text-body">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="brand-lock" className="section-pad bg-canvas">
        <div className="container-page grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-2xl sm:text-3xl tracking-tight">Your brand stays locked</h2>
            <p className="mt-4 text-body">
              The top and bottom bands belong to your organization. Creators never drag the logo or rewrite the phone number.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4" aria-hidden="true">
            <div className="rounded-card border border-line overflow-hidden shadow-soft">
              <p className="text-[11px] font-medium text-muted px-3 py-2 border-b border-line">Before — unlocked</p>
              <div className="h-40 bg-preview flex flex-col">
                <div className="h-8 bg-danger/20" />
                <div className="flex-1 p-3 space-y-2">
                  <div className="h-3 w-3/4 bg-line rounded-chip" />
                  <div className="h-3 w-1/2 bg-line rounded-chip" />
                </div>
                <div className="h-8 bg-accent/30" />
              </div>
            </div>
            <div className="rounded-card border border-line overflow-hidden shadow-soft">
              <p className="text-[11px] font-medium text-muted px-3 py-2 border-b border-line">After — locked</p>
              <div className="h-40 bg-preview flex flex-col">
                <div className="h-8 bg-heading" />
                <div className="flex-1 p-3 space-y-2">
                  <div className="h-3 w-3/4 bg-primary/20 rounded-chip" />
                  <div className="h-3 w-1/2 bg-primary/20 rounded-chip" />
                </div>
                <div className="h-8 bg-heading" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-pad bg-section">
        <div className="container-page grid lg:grid-cols-2 gap-12 items-center">
          <div className="order-2 lg:order-1 flex justify-center" aria-hidden="true">
            <div className="card-surface p-6 w-full max-w-sm text-center">
              <RefreshCw className="w-8 h-8 text-primary mx-auto" />
              <p className="mt-3 text-sm font-semibold text-heading">Shorter copy</p>
              <p className="mt-1 text-sm text-muted">One click. Same brand bands. New wording in the middle.</p>
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <h2 className="text-2xl sm:text-3xl tracking-tight">Regenerate in one click</h2>
            <p className="mt-4 text-body">
              Need a tighter headline or a more formal tone? Ask again without touching the kit. The locked zones stay put.
            </p>
          </div>
        </div>
      </section>

      <section id="formats" className="section-pad bg-canvas">
        <div className="container-page grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-2xl sm:text-3xl tracking-tight">Download anywhere</h2>
            <p className="mt-4 text-body">
              Save a PNG for chat, a JPG for email, or a PDF for print. Files are built on your device.
            </p>
          </div>
          <div className="flex justify-center" aria-hidden="true">
            <div className="flex gap-3">
              {['PNG', 'JPG', 'PDF'].map((f) => (
                <div key={f} className="card-surface px-5 py-6 text-center min-w-[88px]">
                  <FileDown className="w-5 h-5 text-primary mx-auto" />
                  <p className="mt-2 text-sm font-semibold text-heading">{f}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="made-for" className="section-pad bg-section scroll-mt-20">
        <div className="container-page">
          <h2 className="text-2xl sm:text-3xl tracking-tight">Made for</h2>
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {AUDIENCES.map((a) => (
              <div key={a.title} className="card-surface p-5">
                <h3 className="text-base">{a.title}</h3>
                <p className="mt-2 text-sm text-body">{a.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="section-pad bg-canvas scroll-mt-20">
        <div className="container-page">
          <h2 className="text-2xl sm:text-3xl tracking-tight">Pricing</h2>
          <p className="mt-2 text-body">Choose a starting point. Billing is not live yet.</p>
          <div className="mt-10 grid md:grid-cols-3 gap-6 items-stretch">
            {[
              // Placeholder prices — not billed
              { name: 'Free', price: '$0', note: 'Try layouts on one brand kit.', items: ['1 organization', 'Core templates', 'PNG downloads'] },
              { name: 'Pro', price: '$29', note: 'For a busy comms team.', items: ['Unlimited drafts', 'JPG and PDF', 'Priority layouts'], highlight: true },
              { name: 'Team', price: '$79', note: 'Several brands, one workspace.', items: ['Several kits', 'Admin controls', 'Shared history'] },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`rounded-card border p-6 shadow-soft ${
                  plan.highlight ? 'border-primary bg-section' : 'border-line bg-canvas'
                }`}
              >
                {plan.highlight && (
                  <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">Most used</p>
                )}
                <h3 className="text-lg">{plan.name}</h3>
                <p className="mt-2 text-3xl font-semibold text-heading tracking-tight">
                  {plan.price}
                  <span className="text-sm font-medium text-muted"> /mo</span>
                </p>
                <p className="mt-2 text-sm text-muted">{plan.note}</p>
                <ul className="mt-4 space-y-2 text-sm text-body">
                  {plan.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <button type="button" onClick={() => goCreate('')} className="btn-primary w-full mt-6">
                  Log in to create
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="section-pad bg-section scroll-mt-20">
        <div className="container-page max-w-3xl">
          <h2 className="text-2xl sm:text-3xl tracking-tight mb-8">Questions</h2>
          <FaqAccordion />
        </div>
      </section>

      <section className="bg-primary text-white">
        <div className="container-page py-16 text-center">
          <Lock className="w-8 h-8 mx-auto mb-4 opacity-90" />
          <h2 className="text-2xl sm:text-3xl text-white tracking-tight">Keep the brand. Change the event.</h2>
          <p className="mt-3 text-sm sm:text-base text-white/90 max-w-xl mx-auto">
            Write the next poster in a sentence. Header and footer stay yours.
          </p>
          <button type="button" onClick={() => goCreate('')} className="mt-6 inline-flex items-center justify-center rounded-btn bg-canvas text-primary px-5 py-2.5 text-sm font-semibold hover:bg-section">
            Log in to create
          </button>
        </div>
      </section>
    </div>
  );
}
