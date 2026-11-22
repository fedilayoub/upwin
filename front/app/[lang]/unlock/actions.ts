'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { isLocale } from '@/i18n/config';
import {
  APP_SESSION_COOKIE,
  APP_SESSION_MAX_AGE_SECONDS,
  configuredAppPassword,
  safeEqual,
  safeNextPath,
  sessionTokenFor,
} from '@/lib/app-session';

export interface UnlockState {
  wrong: boolean;
}

export async function unlockAction(
  localeValue: string,
  _previous: UnlockState,
  formData: FormData,
): Promise<UnlockState> {
  void _previous;
  const locale = isLocale(localeValue) ? localeValue : 'en';
  const home = `/${locale}`;
  const password = configuredAppPassword();
  if (password === null) redirect(home);

  const attempt = formData.get('password');
  // Compare HMACs, not the raw strings, so the comparison is constant-time
  // whatever the attempt's length.
  const [expected, given] = await Promise.all([
    sessionTokenFor(password),
    sessionTokenFor(typeof attempt === 'string' ? attempt : ''),
  ]);
  if (!safeEqual(given, expected)) return { wrong: true };

  (await cookies()).set(APP_SESSION_COOKIE, expected, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: APP_SESSION_MAX_AGE_SECONDS,
  });
  redirect(safeNextPath(formData.get('next'), home));
}
