import { NextResponse, type NextRequest } from 'next/server';
import { defaultLocale, isLocale, localeCookieName, type Locale } from '@/i18n/config';
import { APP_SESSION_COOKIE, configuredAppPassword, isPublicPath, isUnlocked } from '@/lib/app-session';

function preferredLocale(request: NextRequest): Locale {
  const savedLocale = request.cookies.get(localeCookieName)?.value;
  if (savedLocale && isLocale(savedLocale)) return savedLocale;

  const acceptedLanguages = request.headers
    .get('accept-language')
    ?.split(',')
    .map((entry) => {
      const [tag, quality = 'q=1'] = entry.trim().split(';');
      return { locale: tag.toLowerCase().split('-')[0], quality: Number(quality.replace('q=', '')) || 0 };
    })
    .sort((a, b) => b.quality - a.quality);

  const matchedLocale = acceptedLanguages?.find((entry) => isLocale(entry.locale))?.locale;
  return matchedLocale && isLocale(matchedLocale) ? matchedLocale : defaultLocale;
}

/**
 * Two rules. Every page lives under a locale prefix. And on an online install
 * (APP_PASSWORD set), everything but a client's video link and the unlock page
 * needs the unlock cookie. There are no accounts.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (isStaticMetadataRoute(pathname)) return NextResponse.next();

  const password = configuredAppPassword();
  if (
    password !== null &&
    !isPublicPath(pathname) &&
    !(await isUnlocked(request.cookies.get(APP_SESSION_COOKIE)?.value, password))
  ) {
    if (pathname === '/api' || pathname.startsWith('/api/')) {
      return new NextResponse(null, { status: 401 });
    }
    const segment = pathname.split('/')[1];
    const locale = isLocale(segment) ? segment : preferredLocale(request);
    const unlockUrl = new URL(`/${locale}/unlock`, request.url);
    unlockUrl.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(unlockUrl);
  }

  if (pathname === '/api' || pathname.startsWith('/api/')) return NextResponse.next();

  const firstSegment = pathname.split('/')[1];
  if (isLocale(firstSegment)) return NextResponse.next();

  const locale = preferredLocale(request);
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;
  const response = NextResponse.redirect(redirectUrl);
  response.cookies.set(localeCookieName, locale, {
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
  });
  return response;
}

export function isStaticMetadataRoute(pathname: string) {
  return pathname === '/manifest.webmanifest';
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|xml|txt)).*)',
    '/api/:path*',
  ],
};
