import type { FastifyError, FastifyInstance } from 'fastify';
import type { ApiErrorBody } from '@hyzmat/shared';
import { AppError } from '../lib/errors';

export function registerErrorHandling(app: FastifyInstance) {
  app.setErrorHandler((err: FastifyError | AppError, req, reply) => {
    if (err instanceof AppError) {
      const body: ApiErrorBody = {
        error: {
          code: err.code,
          message: err.message,
          ...(err.details ? { details: err.details } : {}),
        },
      };
      return reply.code(err.statusCode).send(body);
    }

    // Ошибки Fastify уровня клиента (битый JSON, слишком большое тело и т.п.)
    if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
      return reply.code(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Некорректный запрос' },
      } satisfies ApiErrorBody);
    }

    req.log.error({ err }, 'unhandled error');
    return reply.code(500).send({
      error: { code: 'INTERNAL_ERROR', message: 'Что-то пошло не так. Попробуйте позже' },
    } satisfies ApiErrorBody);
  });

  app.setNotFoundHandler((_req, reply) =>
    reply.code(404).send({
      error: { code: 'NOT_FOUND', message: 'Не найдено' },
    } satisfies ApiErrorBody),
  );
}
