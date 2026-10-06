import React, { useId, useState } from 'react';

const FAQS = [
  {
    q: 'Does the poster rewrite my logo or colors?',
    a: 'No. Your brand kit locks the logo, header, footer, colors, fonts, and contacts. Brandframe only writes the middle of the poster.',
  },
  {
    q: 'What do I type in the description box?',
    a: 'Use everyday words: the event name, date, time, and place. If something is missing, that field stays empty on the poster rather than being invented.',
  },
  {
    q: 'Can I change the wording after it is created?',
    a: 'Yes. You can ask for a shorter or more formal version, then download when it looks right.',
  },
  {
    q: 'Which files can I download?',
    a: 'PNG, JPG, and PDF, all made in the browser. Nothing is printed on a remote server.',
  },
  {
    q: 'Who can change the brand kit?',
    a: 'Organization admins. Everyday creators pick a layout and write the event — they cannot move the header or footer.',
  },
  {
    q: 'Do I need design software?',
    a: 'No. If you can describe an event in a sentence, you can make a poster. The layout is already set.',
  },
];

export default function FaqAccordion() {
  const [open, setOpen] = useState(0);
  const baseId = useId();

  return (
    <div className="space-y-2">
      {FAQS.map((item, i) => {
        const panelId = `${baseId}-panel-${i}`;
        const btnId = `${baseId}-btn-${i}`;
        const expanded = open === i;
        return (
          <div key={item.q} className="card-surface">
            <h3>
              <button
                id={btnId}
                type="button"
                className="w-full text-left px-5 py-4 flex items-center justify-between gap-4 text-sm font-semibold text-heading rounded-card"
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => setOpen(expanded ? -1 : i)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setOpen(Math.min(FAQS.length - 1, i + 1));
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setOpen(Math.max(0, i - 1));
                  }
                }}
              >
                {item.q}
                <span className="text-muted text-lg leading-none" aria-hidden>
                  {expanded ? '−' : '+'}
                </span>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={btnId}
              hidden={!expanded}
              className="px-5 pb-4 text-sm text-body"
            >
              {item.a}
            </div>
          </div>
        );
      })}
    </div>
  );
}
