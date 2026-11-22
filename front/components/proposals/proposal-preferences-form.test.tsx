import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  ProposalPreferencesFields,
  ProposalPreferencesFormStatus,
} from '@/components/proposals/proposal-preferences-form';
import dictionary from '@/i18n/dictionaries/en';
import fr from '@/i18n/dictionaries/fr';
import { OUTPUT_LANGUAGES } from '@/lib/api';

vi.mock('@/app/[lang]/(app)/actions', () => ({
  saveProposalPreferencesAction: vi.fn(),
}));

describe('ProposalPreferencesForm', () => {
  it('renders every saved value and the initial live character count', () => {
    const html = renderToStaticMarkup(
      <ProposalPreferencesFields
        copy={dictionary.proposals}
        locale="en"
        preferences={{
          proposalLength: 'long',
          proposalTone: 'friendly',
          answerLength: 'detailed',
          language: 'fr',
          signOffName: 'Alex Morgan',
          customInstructions: 'Lead with measurable outcomes.',
        }}
      />,
    );

    expect(html).toContain('Long');
    expect(html).toContain('Friendly');
    expect(html).toContain('Detailed');
    expect(html).toContain('French');
    expect(html).toContain('value="Alex Morgan"');
    expect(html).toContain('Lead with measurable outcomes.');
    expect(html).toContain('30 / 2,000 characters');
    expect(html).toContain(dictionary.proposals.sections.writingTitle);
    expect(html).toContain(dictionary.proposals.sections.personalTitle);
    expect(html).toContain(dictionary.proposals.sections.guardrailTitle);
    expect(html).toContain(
      dictionary.proposals.answerLengths.detailed.description,
    );
  });

  it('points a failed field at its error text as well as its description', () => {
    const html = renderToStaticMarkup(
      <ProposalPreferencesFields
        copy={dictionary.proposals}
        locale="en"
        fieldErrors={{ signOffName: 'tooLong' }}
        preferences={{
          proposalLength: 'medium',
          proposalTone: 'professional',
          answerLength: 'standard',
          language: 'en',
        }}
      />,
    );

    // The error must be announced, so it carries an id the control names, and
    // the description stays rendered beside it rather than being replaced.
    expect(html).toContain('aria-describedby="signOffName-error signOffName-help"');
    expect(html).toContain('id="signOffName-error"');
    expect(html).toContain('id="signOffName-help"');
    expect(html).toContain(dictionary.proposals.validation.tooLong);
    expect(html).toContain(dictionary.proposals.fieldHelp.signOffName);
  });

  it('names each segmented choice group from its own label', () => {
    const html = renderToStaticMarkup(
      <ProposalPreferencesFields
        copy={dictionary.proposals}
        locale="en"
        preferences={{
          proposalLength: 'medium',
          proposalTone: 'professional',
          answerLength: 'standard',
          language: 'en',
        }}
      />,
    );

    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('aria-labelledby="proposalLength-label"');
    expect(html).toContain('id="proposalLength-label"');
    // Every option is visible at once, which is the point of the swap.
    expect(html).toContain(dictionary.proposals.proposalLengths.short.label);
    expect(html).toContain(dictionary.proposals.proposalLengths.medium.label);
    expect(html).toContain(dictionary.proposals.proposalLengths.long.label);
  });

  it.each([
    ['en', dictionary, ['Dutch', 'English', 'French', 'German', 'Italian', 'Portuguese', 'Spanish']],
    ['fr', fr, ['Allemand', 'Anglais', 'Espagnol', 'Français', 'Italien', 'Néerlandais', 'Portugais']],
  ] as const)(
    'offers every output language, alphabetical in %s',
    (locale, copy, expected) => {
      const html = renderToStaticMarkup(
        <ProposalPreferencesFields
          copy={copy.proposals}
          locale={locale}
          preferences={{
            proposalLength: 'medium',
            proposalTone: 'professional',
            answerLength: 'standard',
            language: 'pt',
          }}
        />,
      );

      const wheel = html.slice(html.indexOf('data-kit="wheel"'));
      const labels = [...wheel.matchAll(/data-kit="wheel-face">([^<]+)</g)].map(
        (match) => match[1],
      );
      expect(labels).toEqual(expected);
      expect(labels).toHaveLength(OUTPUT_LANGUAGES.length);
    },
  );

  it('renders an API validation message as an alert', () => {
    const html = renderToStaticMarkup(
      <ProposalPreferencesFormStatus
        state={{
          status: 'error',
          message: 'The custom instructions exceed the allowed length.',
        }}
      />,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain(
      'The custom instructions exceed the allowed length.',
    );
  });
});
