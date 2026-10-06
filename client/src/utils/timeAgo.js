const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

export function timeAgo(value) {
  if (!value) return '';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Math.max(0, Date.now() - then);

  if (diff < MINUTE * 1000) return 'Just now';
  if (diff < HOUR * 1000) {
    const n = Math.floor(diff / (MINUTE * 1000));
    return `${n} minute${n === 1 ? '' : 's'} ago`;
  }
  if (diff < DAY * 1000) {
    const n = Math.floor(diff / HOUR);
    return `${n} hour${n === 1 ? '' : 's'} ago`;
  }
  if (diff < WEEK * 1000) {
    const n = Math.floor(diff / DAY);
    if (n === 1) return 'Yesterday';
    return `${n} days ago`;
  }
  if (diff < MONTH * 1000) {
    const n = Math.floor(diff / WEEK);
    return `${n} week${n === 1 ? '' : 's'} ago`;
  }
  if (diff < YEAR * 1000) {
    const n = Math.floor(diff / MONTH);
    return `${n} month${n === 1 ? '' : 's'} ago`;
  }
  const n = Math.floor(diff / YEAR);
  return `${n} year${n === 1 ? '' : 's'} ago`;
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
