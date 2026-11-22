export function formatDuration(ms: number | null): string {
  if (ms === null) return '–';
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function formatStorage(bytes: number, locale: string): string {
  const gb = bytes / 1024 ** 3;
  return (
    new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
      gb >= 1 ? gb : bytes / 1024 ** 2,
    ) + (gb >= 1 ? ' GB' : ' MB')
  );
}
