import { z } from 'zod';

const profileAnalysisCursorPayloadSchema = z
  .object({
    createdAt: z.iso.datetime(),
    id: z.uuid(),
  })
  .strict();

export interface ProfileAnalysisCursor {
  createdAt: string;
  id: string;
}

export function encodeProfileAnalysisCursor(
  cursor: ProfileAnalysisCursor,
): string {
  return Buffer.from(
    JSON.stringify({
      createdAt: cursor.createdAt,
      id: cursor.id,
    }),
    'utf8',
  ).toString('base64url');
}

export function decodeProfileAnalysisCursor(
  value: string,
): ProfileAnalysisCursor | null {
  try {
    const payload = profileAnalysisCursorPayloadSchema.safeParse(
      JSON.parse(Buffer.from(value, 'base64url').toString('utf8')),
    );
    if (!payload.success) return null;

    return {
      createdAt: payload.data.createdAt,
      id: payload.data.id,
    };
  } catch {
    return null;
  }
}

export function isProfileAnalysisCursor(value: string): boolean {
  return decodeProfileAnalysisCursor(value) !== null;
}
