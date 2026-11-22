import { ArrowUpRight } from 'lucide-react';

export function PlatformLink({
  label,
  path,
  platformUrl,
}: {
  label: string;
  path: string;
  platformUrl: string;
}) {
  return (
    <a
      className="inline-flex items-center gap-1 font-semibold text-primary-strong outline-none hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring/35"
      href={buildPlatformDeepLink(path, platformUrl)}
      rel="noreferrer"
      target="_blank"
    >
      {label} <ArrowUpRight className="size-3.5" />
    </a>
  );
}

export function buildPlatformDeepLink(
  path: string,
  platformUrl: string,
): string {
  try {
    return new URL(path, platformUrl).toString();
  } catch {
    return '#';
  }
}

