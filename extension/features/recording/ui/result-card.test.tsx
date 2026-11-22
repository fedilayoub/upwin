import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ResultCard } from "./result-card";
it("leads with the share link, and keeps the title editable in place", () => {
  const markup = renderToStaticMarkup(
    <ResultCard
      videoId="id"
      shareUrl="https://upwin.example.com/v/Abcd1234efGH"
      elapsedMs={95000}
      onAnother={() => undefined}
    />,
  );
  for (const text of [
    'aria-label="Share link"',
    'value="https://upwin.example.com/v/Abcd1234efGH"',
    "Copy link",
    "Copy sentence",
    'href="https://upwin.example.com/v/Abcd1234efGH"',
    "Record another",
    'aria-label="Delete"',
    'aria-label="Title"',
    "1:35",
    "Uploading",
  ])
    expect(markup).toContain(text);
  // Renaming saves on Enter or when leaving the field: no separate button.
  expect(markup).not.toContain("Save title");
});
