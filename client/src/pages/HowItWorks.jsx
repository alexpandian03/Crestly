import React from 'react';
import { Link } from 'react-router-dom';
import { APP_NAME } from '../config/brand';

const STEPS = [
  { n: '1', title: 'Describe the event', body: 'Name, date, time, and place in everyday words.' },
  { n: '2', title: 'Pick a layout', body: 'Choose a template. Header and footer stay in place.' },
  { n: '3', title: 'Review the middle', body: `${APP_NAME} fills only the center. Your brand header and footer stay put.` },
  { n: '4', title: 'Download', body: 'Save as PNG, JPG, or PDF and share.' },
];

export default function HowItWorks() {
  return (
    <div className="container-page section-pad max-w-2xl">
      <h1 className="text-3xl tracking-tight">How it works</h1>
      <p className="mt-2 text-body">Four steps from a short description to a finished poster.</p>
      <ol className="mt-8 space-y-4">
        {STEPS.map((s) => (
          <li key={s.n} className="card-surface p-5 flex gap-4">
            <span className="flex-shrink-0 w-8 h-8 rounded-btn bg-primary text-white text-sm font-semibold flex items-center justify-center">
              {s.n}
            </span>
            <div>
              <h2 className="text-base">{s.title}</h2>
              <p className="text-sm text-body mt-1">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <Link to="/" className="btn-primary mt-8 inline-flex">
        Back to home
      </Link>
    </div>
  );
}
