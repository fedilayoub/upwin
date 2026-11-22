import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { RecoveryBanner } from "./recovery-banner";
it("recovery-banner renders its accessible controls", () => {
  const markup = renderToStaticMarkup(
    <RecoveryBanner sessions={[{ sessionId: "pending", createdAt: 1000 }]} />,
  );
  expect(markup).toContain("didn’t finish uploading");
  expect(markup).toContain("Upload what was recorded");
  expect(markup).toContain("Discard");
});
