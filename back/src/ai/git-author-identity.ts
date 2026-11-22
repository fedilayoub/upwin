import { execFileSync } from 'node:child_process';

export type GitAuthorConfigKey = 'user.name' | 'user.email';
export type GitConfigReader = (key: GitAuthorConfigKey) => string | undefined;

export function readGitConfig(key: GitAuthorConfigKey): string | undefined {
  try {
    const value = execFileSync('git', ['config', key], {
      encoding: 'utf8',
    }).trim();
    return value.length > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

export function readGitAuthorSensitiveTerms(
  reader: GitConfigReader = readGitConfig,
): string[] {
  const name = safelyReadGitConfig(reader, 'user.name');
  const email = safelyReadGitConfig(reader, 'user.email');
  const normalizedName = normalizeTerm(name);
  const reversedName = reverseName(normalizedName);
  const normalizedEmail = normalizeTerm(email);
  const emailLocalPart = normalizeTerm(normalizedEmail?.split('@')[0]);

  return uniqueUsableTerms([
    normalizedName,
    reversedName,
    normalizedEmail,
    emailLocalPart,
  ]);
}

function safelyReadGitConfig(
  reader: GitConfigReader,
  key: GitAuthorConfigKey,
): string | undefined {
  try {
    return reader(key);
  } catch {
    return undefined;
  }
}

function normalizeTerm(value: string | undefined): string | undefined {
  const normalized = value?.replace(/\s+/gu, ' ').trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function reverseName(name: string | undefined): string | undefined {
  if (!name) return undefined;
  const parts = name.split(' ');
  return parts.length > 1 ? [...parts].reverse().join(' ') : undefined;
}

function uniqueUsableTerms(terms: Array<string | undefined>): string[] {
  const unique = new Map<string, string>();

  for (const term of terms) {
    if (!term) continue;
    // One- and two-character identities are too broad and would corrupt
    // unrelated words throughout a recorded prompt.
    if (term.length < 3) continue;
    unique.set(term.toLocaleLowerCase(), term);
  }

  return [...unique.values()];
}
