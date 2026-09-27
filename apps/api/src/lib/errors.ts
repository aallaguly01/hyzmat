import type { ApiErrorIssue, ErrorCode } from '@hyzmat/shared';
import type { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: ApiErrorIssue[],
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const unauthorized = (code: ErrorCode, message: string) => new AppError(401, code, message);

export const notFound = () => new AppError(404, 'NOT_FOUND', 'Заявка не найдена');

export const forbidden = () => new AppError(403, 'FORBIDDEN', 'Можно изменять только свои заявки');

export function validationError(error: ZodError): AppError {
  const details = error.issues.map((i) => ({ path: i.path, message: i.message }));
  return new AppError(
    400,
    'VALIDATION_ERROR',
    details[0]?.message ?? 'Некорректные данные',
    details,
  );
}
