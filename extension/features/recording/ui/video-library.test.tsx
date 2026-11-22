import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { video } from "../test-fixtures";
vi.mock("@/hooks/use-async-action", () => ({
  useAsyncAction: () => ({
    data: {
      items: [
        {
          ...video,
          status: "ready",
          viewCount: 3,
          finishedViews: 2,
          averageWatchedPercent: 64,
          durationMs: 30000,
        },
      ],
    },
    status: "success",
    execute: vi.fn(),
  }),
}));
import { VideoLibrary } from "./video-library";
it("shows each video as a carousel slide with its watch stats and actions", () => {
  const markup = renderToStaticMarkup(<VideoLibrary />);
  for (const text of [
    "Recent videos",
    "A walkthrough",
    "3 views",
    "64% watched",
    "2 to the end",
    "Copy link",
    'aria-label="Delete"',
    'aria-roledescription="slide"',
    "See all on the web",
  ])
    expect(markup).toContain(text);
  // A ready video needs no status chip.
  expect(markup).not.toContain(">Ready<");
});
