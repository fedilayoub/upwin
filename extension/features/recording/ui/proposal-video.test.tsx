import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { video } from "../test-fixtures";
const mocks = vi.hoisted(() => ({ items: [] as unknown[] }));
vi.mock("@/hooks/use-async-action", () => ({
  useAsyncAction: () => ({ data: { items: mocks.items }, execute: vi.fn() }),
}));
import { SupportedProposalVideo } from "./proposal-video";
it("offers Record without a video and copy actions once one exists", () => {
  const render = () =>
    renderToStaticMarkup(
      <SupportedProposalVideo
        jobSnapshotId={video.id}
        jobTitle="Build a website"
        proposalText="My proposal"
        onRecord={vi.fn()}
      />,
    );
  mocks.items = [];
  expect(render()).toContain("Record a video for this job");
  expect(render()).not.toContain("Copy proposal + video link");
  mocks.items = [video];
  expect(render()).toContain("Copy proposal + video link");
  expect(render()).toContain("A walkthrough");
});
