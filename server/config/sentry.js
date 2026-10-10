import * as Sentry from '@sentry/node';

let initialized = false;

export function initServerSentry() {
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
    });
    initialized = true;
  }
}

export function captureServerException(err) {
  if (initialized) {
    Sentry.captureException(err);
  }
}

export { Sentry };
