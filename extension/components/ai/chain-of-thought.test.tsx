import { Circle } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtSearchResult,
  ChainOfThoughtSearchResults,
  ChainOfThoughtStep,
} from './chain-of-thought';

describe('ChainOfThought', () => {
  it('renders every step when open', () => {
    const markup = renderChain();

    expect(markup).toContain('First step');
    expect(markup).toContain('Second step');
  });

  it('renders the header and no steps when closed by default', () => {
    const markup = renderToStaticMarkup(
      <ChainOfThought defaultOpen={false}>
        <ChainOfThoughtHeader>Working</ChainOfThoughtHeader>
        <ChainOfThoughtContent>
          <ChainOfThoughtStep label="Hidden step" />
        </ChainOfThoughtContent>
      </ChainOfThought>,
    );

    expect(markup).toContain('Working');
    expect(markup).not.toContain('Hidden step');
  });

  it('shimmers only the active step label', () => {
    const markup = renderChain();

    expect(markup.match(/ shimmer /g)).toHaveLength(1);
    expect(markup).toMatch(/shimmer[^>]*>Second step/);
  });

  it('uses an indicator instead of the icon and renders search-result badges', () => {
    const markup = renderToStaticMarkup(
      <ChainOfThought>
        <ChainOfThoughtHeader>Working</ChainOfThoughtHeader>
        <ChainOfThoughtContent>
          <ChainOfThoughtStep
            icon={Circle}
            indicator={<span data-custom-indicator />}
            label="Evidence"
          >
            <ChainOfThoughtSearchResults>
              <ChainOfThoughtSearchResult>TypeScript</ChainOfThoughtSearchResult>
            </ChainOfThoughtSearchResults>
          </ChainOfThoughtStep>
        </ChainOfThoughtContent>
      </ChainOfThought>,
    );

    expect(markup).toContain('data-custom-indicator');
    expect(markup).not.toContain('lucide-circle');
    expect(markup).toContain('TypeScript');
    expect(markup).toContain('bg-secondary');
  });
});

function renderChain(): string {
  return renderToStaticMarkup(
    <ChainOfThought>
      <ChainOfThoughtHeader>Working</ChainOfThoughtHeader>
      <ChainOfThoughtContent>
        <ChainOfThoughtStep label="First step" status="complete" />
        <ChainOfThoughtStep label="Second step" status="active" />
      </ChainOfThoughtContent>
    </ChainOfThought>,
  );
}
