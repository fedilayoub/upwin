import { redirect } from 'next/navigation';
import { isLocale } from '@/i18n/config';

export default async function SettingsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  redirect(`/${isLocale(lang) ? lang : 'en'}/settings/connection`);
}
