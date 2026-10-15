import crypto from 'crypto';
import pino from 'pino';
import pinoHttp from 'pino-http';

export const logger = pino({
  level: process.env.NODE_ENV === 'test' ? 'silent' : process.env.LOG_LEVEL || 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-client-id"]',
      'req.headers["x-auth-token"]',
      'password',
      'token',
      'secret',
      'jwt',
      '*.password',
      '*.token',
      '*.secret',
    ],
    remove: true,
  },
});

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => req.headers['x-request-id'] || crypto.randomUUID(),
  serializers: {
    req(req) {
      return {
        id: req.id,
        method: req.method,
        url: req.url,
        query: req.query,
      };
    },
    res(res) {
      return {
        statusCode: res.statusCode,
      };
    },
  },
  autoLogging: {
    ignore: (req) => req.url === '/api/health' || req.url === '/health',
  },
});
