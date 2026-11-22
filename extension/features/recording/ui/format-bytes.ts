/** MB under 1 GB, GB above it: storage usage on a self-hosted install can run into gigabytes. */
export function formatBytes(bytes: number, locale: string): string {
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: gb < 10 ? 1 : 0 }).format(gb)} GB`;
  }
  const mb = bytes / 1024 ** 2;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: mb < 10 ? 1 : 0 }).format(mb)} MB`;
}
