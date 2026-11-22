import { useEffect } from 'react';
import {
  LoaderCircle,
  Palette,
  PlugZap,
  Radio,
  Settings,
} from 'lucide-react';
import { PageHeading } from '@/components/shared/page-heading';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConnectionForm } from '@/features/connection/connection-form';
import { DiagnosticsSection } from '@/features/diagnostics/diagnostics-section';
import { useI18n } from '@/features/i18n/i18n-context';
import type { Locale } from '@/features/i18n/locale';
import { useAsyncAction } from '@/hooks/use-async-action';
import {
  useTheme,
  type ThemePreference,
} from '@/features/theme/theme-context';
import { extensionService } from '@/services/extension';
export function SettingsScreen() {
  const { locale, setLocale, t } = useI18n();
  const { preference: themePreference, setPreference: setThemePreference } =
    useTheme();
  const runtime = useAsyncAction(extensionService.getRuntimeStatus);

  useEffect(() => {
    if (runtime.status === 'idle') void runtime.execute();
  }, [runtime.execute, runtime.status]);

  return (
    <div className="space-y-5">
      <PageHeading
        description={t('settings.description')}
        icon={Settings}
        title={t('settings.title')}
      />

      <Card className="overflow-hidden">
        <CardContent className="grid p-0 min-[760px]:grid-cols-2">
          <section className="border-b border-border/70 p-4 min-[760px]:border-r">
          <SettingHeading icon={PlugZap} label={t('settings.connection')} />
          <p className="mb-3 mt-1.5 text-xs leading-relaxed text-muted-foreground">
            {t('settings.connectionHelp')}
          </p>
          <ConnectionForm />

          </section>
          <section className="border-b border-border/70 p-4">
          <SettingHeading icon={Palette} label={t('settings.appearance')} />
          <div className="mt-3 space-y-4">
            <LabeledSelect label={t('settings.colorTheme')}>
              <Select
                onValueChange={(value: ThemePreference) =>
                  void setThemePreference(value)
                }
                value={themePreference}
              >
                <SelectTrigger aria-label={t('settings.colorTheme')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">{t('settings.system')}</SelectItem>
                  <SelectItem value="light">{t('settings.light')}</SelectItem>
                  <SelectItem value="dark">{t('settings.dark')}</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {t('settings.themeHelp')}
              </p>
            </LabeledSelect>

            <LabeledSelect label={t('settings.language')}>
              <Select
                onValueChange={(value: Locale) => void setLocale(value)}
                value={locale}
              >
                <SelectTrigger aria-label={t('settings.language')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">{t('settings.english')}</SelectItem>
                  <SelectItem value="fr">{t('settings.french')}</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {t('settings.languageHelp')}
              </p>
            </LabeledSelect>
          </div>

          </section>
          <section className="p-4 min-[760px]:col-span-2">
          <SettingHeading icon={Radio} label={t('settings.extension')} />
          <div className="mt-3 flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2.5">
            <span className="flex items-center gap-2 text-xs font-medium">
              <Radio className="size-3.5 text-muted-foreground" />{' '}
              {t('settings.runtimeStatus')}
            </span>
            {runtime.status === 'loading' || runtime.status === 'idle' ? (
              <LoaderCircle className="size-3.5 animate-spin text-muted-foreground" />
            ) : runtime.data?.connected ? (
              <Badge variant="success">
                {t('settings.connected', { version: runtime.data.version })}
              </Badge>
            ) : (
              <Badge variant="warning">{t('settings.unavailable')}</Badge>
            )}
          </div>
          </section>
        </CardContent>
      </Card>

      <DiagnosticsSection />
    </div>
  );
}

function SettingHeading({
  icon: Icon,
  label,
}: {
  icon: typeof PlugZap;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
      <Icon className="size-3.5" />
      {label}
    </div>
  );
}

function LabeledSelect({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}
