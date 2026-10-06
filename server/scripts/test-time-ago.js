/**
 * Plain Node check of the "updated … ago" label: no server, no database, no browser.
 * Run with `npm run test:timeago`.
 */
import { fullDateTime, timeAgo } from '../../client/src/utils/timeAgo.js';

let passed = 0;
function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`PASS ${message}`);
  passed += 1;
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/* One fixed moment so the answers never depend on when the test runs. */
const NOW = new Date('2026-10-06T12:00:00Z').getTime();
const ago = (ms) => timeAgo(NOW - ms, NOW);

assert(ago(0) === 'just now', 'a save a moment ago reads "just now"');
assert(ago(59 * SECOND) === 'just now', '59 seconds is still "just now"');
assert(ago(60 * SECOND) === '1 minute ago', 'one minute is singular');
assert(ago(59 * MINUTE) === '59 minutes ago', '59 minutes still counts minutes');
assert(ago(HOUR) === '1 hour ago', 'one hour is singular');
assert(ago(23 * HOUR + 59 * MINUTE) === '23 hours ago', 'a day is not reached until 24 hours');
assert(ago(DAY) === '1 day ago', 'one day is singular');
assert(ago(2 * DAY + 6 * HOUR) === '2 days ago', 'days are counted, not weeks');
assert(ago(29 * DAY + 23 * HOUR) === '29 days ago', 'the last day before the date switch');
assert(ago(30 * DAY) === new Date(NOW - 30 * DAY).toLocaleDateString(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
}), 'past 30 days the real date is shown');
assert(ago(400 * DAY).includes('1970') === false, 'a long-old save still shows its own year, never an age');
assert(ago(400 * DAY) === new Date(NOW - 400 * DAY).toLocaleDateString(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
}), 'a year-old save reads as its date');

assert(ago(5 * DAY) === '5 days ago', 'the label never says weeks or months');
assert(!/week|month|year/.test(ago(400 * DAY)) || /\d{4}/.test(ago(400 * DAY)), 'no "N months ago" wording survives');

assert(timeAgo('', NOW) === '', 'no date means no words');
assert(timeAgo(null, NOW) === '', 'a missing date means no words');
assert(timeAgo('not a date', NOW) === '', 'a broken date says nothing rather than "NaN days ago"');
assert(timeAgo(NOW + 5 * MINUTE, NOW) === 'just now', 'a clock a few seconds ahead cannot show a negative age');

assert(typeof fullDateTime(NOW) === 'string' && fullDateTime(NOW).length > 0, 'the exact time is still available for a tooltip');
assert(fullDateTime('') === '', 'the exact time of nothing is nothing');

console.log(`\n${passed} assertions passed.`);
