const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
/** Past this many days "N days ago" stops being useful and the plain date reads better. */
const COUNT_DAYS_UP_TO = 30;

/** The date with a name and a year, for anything older than a month. */
function asDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * How long ago something was saved, in the words a person would use: "just now", a few
 * minutes, a few hours, a few days, then the date itself. `now` exists so a test can ask
 * about a fixed moment; real callers leave it out.
 */
export function timeAgo(value, now = Date.now()) {
  if (!value) return '';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Math.max(0, now - then);

  if (diff < MINUTE) return 'just now';
  if (diff < HOUR) {
    const n = Math.floor(diff / MINUTE);
    return `${n} minute${n === 1 ? '' : 's'} ago`;
  }
  if (diff < DAY) {
    const n = Math.floor(diff / HOUR);
    return `${n} hour${n === 1 ? '' : 's'} ago`;
  }
  if (diff < COUNT_DAYS_UP_TO * DAY) {
    const n = Math.floor(diff / DAY);
    return `${n} day${n === 1 ? '' : 's'} ago`;
  }
  return asDate(value);
}

export function fullDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
