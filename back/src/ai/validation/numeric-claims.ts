const PAST_TENSE_ACHIEVEMENT_VERBS = [
  'built',
  'created',
  'delivered',
  'designed',
  'developed',
  'implemented',
  'launched',
  'increased',
  'reduced',
  'improved',
  'achieved',
  'managed',
  'led',
  'grew',
  'generated',
  'completed',
  'cut',
  'boosted',
  'saved',
  'earned',
  'served',
] as const;

const PAST_TENSE_ACHIEVEMENT_VERBS_SOURCE =
  PAST_TENSE_ACHIEVEMENT_VERBS.join('|');

export const PAST_TENSE_ACHIEVEMENT_PATTERN = new RegExp(
  `(?:^|[.!?]\\s+|\\n+\\s*|[-*]\\s*)(?:i\\s+|we\\s+)?(?:${PAST_TENSE_ACHIEVEMENT_VERBS_SOURCE})\\b|\\b(?:you|i|we)\\s+(?:${PAST_TENSE_ACHIEVEMENT_VERBS_SOURCE})\\b|\\b(?:results?|features?|projects?|work|technologies?)\\s+(?:${PAST_TENSE_ACHIEVEMENT_VERBS_SOURCE}|used)\\b`,
  'iu',
);

const NUMBER_WORD_VALUES = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
} as const;

const NUMBER_WORD_SOURCE = Object.keys(NUMBER_WORD_VALUES)
  .concat('hundred', 'thousand')
  .join('|');
const NUMBER_EXPRESSION_SOURCE = `(?:\\d+(?:[.,]\\d+)*|(?:${NUMBER_WORD_SOURCE})(?:(?:[\\s-]+)(?:and[\\s-]+)?(?:${NUMBER_WORD_SOURCE}))*)`;
const NUMBER_EXPRESSION_PATTERN = new RegExp(
  `(?<![\\p{L}\\p{N}_])${NUMBER_EXPRESSION_SOURCE}(?![\\p{L}\\p{N}_])`,
  'giu',
);
const RATED_FRACTION_SUFFIX_PATTERN = new RegExp(
  `^\\s*(?:/|out\\s+of)\\s*${NUMBER_EXPRESSION_SOURCE}`,
  'iu',
);
const PAST_ACHIEVEMENT_BEFORE_NUMBER_PATTERN = new RegExp(
  `\\b(?:${PAST_TENSE_ACHIEVEMENT_VERBS_SOURCE})\\b[^.!?\\n]{0,100}$`,
  'iu',
);
const OUTCOME_DELTA_BEFORE_NUMBER_PATTERN = new RegExp(
  `\\b(?:${PAST_TENSE_ACHIEVEMENT_VERBS_SOURCE})\\b[^.!?\\n]{0,80}\\bby\\s*$`,
  'iu',
);
const PAST_WORK_COUNT_SUFFIX_PATTERN =
  /^\s+(?:(?:[\p{L}][\p{L}'’-]*\s+){0,2})(?:websites?|sites?|projects?|clients?|customers?|apps?|applications?|products?|systems?|platforms?|dashboards?|features?|campaigns?|designs?|solutions?|engagements?|contracts?|jobs?|teams?|businesses?|case\s+stud(?:y|ies))\b/iu;
const RATING_SUFFIX_PATTERN =
  /^\s*(?:-\s*)?(?:stars?|star\s+rating|reviews?)\b/iu;
const MONEY_OUTCOME_NOUN_PATTERN =
  /\b(?:revenue|sales|earnings|income|profit|value)\b/iu;

interface NumericExpression {
  claim: string;
  end: number;
  start: number;
}

export function hasUnsupportedNumericClaim(
  candidateText: string,
  ...factualInputs: unknown[]
): boolean {
  const allowed = new Set(
    factualInputs.flatMap((input) => {
      const serialized = JSON.stringify(input);
      return serialized === undefined ? [] : extractNumericClaims(serialized);
    }),
  );

  return extractCredentialNumericClaims(candidateText).some(
    (claim) => !allowed.has(claim),
  );
}

export function extractNumericClaims(value: string): string[] {
  return [...value.matchAll(/\d+(?:[.,]\d+)*/g)].map(([claim]) =>
    normalizeNumericClaim(claim),
  );
}

export function normalizeNumericClaim(claim: string): string {
  const normalizedDigits = Number(claim.replaceAll(',', ''));
  if (Number.isFinite(normalizedDigits)) return String(normalizedDigits);

  const tokens = claim.toLowerCase().split(/[\s-]+/u);
  let current = 0;
  let total = 0;
  for (const token of tokens) {
    if (token === 'and') continue;
    if (token === 'hundred') {
      current = (current || 1) * 100;
      continue;
    }
    if (token === 'thousand') {
      total += (current || 1) * 1_000;
      current = 0;
      continue;
    }
    const value = NUMBER_WORD_VALUES[token as keyof typeof NUMBER_WORD_VALUES];
    if (value === undefined) return claim;
    current += value;
  }

  return String(total + current);
}

function extractCredentialNumericClaims(value: string): string[] {
  return numericExpressions(value)
    .filter((expression) => isCredentialClaim(value, expression))
    .map((expression) => normalizeNumericClaim(expression.claim));
}

function numericExpressions(value: string): NumericExpression[] {
  return [...value.matchAll(NUMBER_EXPRESSION_PATTERN)].map((match) => {
    const claim = match[0];
    const start = match.index;
    return { claim, start, end: start + claim.length };
  });
}

function isCredentialClaim(
  value: string,
  expression: NumericExpression,
): boolean {
  const before = value.slice(
    Math.max(0, expression.start - 180),
    expression.start,
  );
  const after = value.slice(expression.end, expression.end + 180);
  const clauseBefore = textAfterLastBoundary(before);

  if (
    /^\s*\+?\s*(?:years?|yrs?\.?)(?:\s+(?:of\s+(?:[\p{L}'’-]+\s+){0,2}experience|experience|building|developing|designing|working|coding|creating|delivering|in\b)|\s*['’]\s*experience)/iu.test(
      after,
    )
  ) {
    return true;
  }

  const percentage = after.match(/^\s*(?:%|percent(?:age)?\b)/iu);
  if (percentage) {
    const percentageRemainder = after.slice(percentage[0].length);
    if (!/^[\s-]+responsive\b/iu.test(percentageRemainder)) return true;
  }

  if (OUTCOME_DELTA_BEFORE_NUMBER_PATTERN.test(clauseBefore)) return true;

  if (
    PAST_WORK_COUNT_SUFFIX_PATTERN.test(after) &&
    PAST_ACHIEVEMENT_BEFORE_NUMBER_PATTERN.test(clauseBefore)
  ) {
    return true;
  }

  if (
    RATING_SUFFIX_PATTERN.test(after) ||
    (/\brated\s*$/iu.test(clauseBefore) &&
      RATED_FRACTION_SUFFIX_PATTERN.test(after))
  ) {
    return true;
  }

  return (
    PAST_ACHIEVEMENT_BEFORE_NUMBER_PATTERN.test(clauseBefore) &&
    MONEY_OUTCOME_NOUN_PATTERN.test(`${clauseBefore}${after}`)
  );
}

function textAfterLastBoundary(value: string): string {
  const boundary = Math.max(
    value.lastIndexOf('.'),
    value.lastIndexOf('!'),
    value.lastIndexOf('?'),
    value.lastIndexOf('\n'),
  );
  return value.slice(boundary + 1);
}
