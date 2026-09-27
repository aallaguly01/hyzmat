import { z } from 'zod';
import { AppError } from '../../lib/errors';

/** Keyset-курсор: [departureDate | null, createdAt ISO, id]. */
const CursorSchema = z.tuple([z.string().nullable(), z.string().datetime(), z.string().uuid()]);
export type Cursor = z.infer<typeof CursorSchema>;

export function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c)).toString('base64url');
}

export function decodeCursor(raw: string): Cursor {
  try {
    return CursorSchema.parse(JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')));
  } catch {
    throw new AppError(400, 'VALIDATION_ERROR', 'Некорректный курсор', [
      { path: ['cursor'], message: 'Некорректный курсор' },
    ]);
  }
}
