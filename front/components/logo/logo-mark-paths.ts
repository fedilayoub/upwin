/**
 * Path data for the upwin glyph, in a 16x16 box: an arch with a rising arrow off
 * its right shoulder. Shared by `LogoMark` and the generated share images
 * (`lib/og`), so the two never drift apart.
 *
 * The right arm stops inside the arrowhead so its round cap never pokes past the
 * tip; the head is symmetric about x=13.
 */
export const LOGO_MARK_VIEW_BOX = '0 0 16 16';
export const LOGO_MARK_ARCH = { d: 'M3 2.5v6.25a5 5 0 0 0 10 0V3.4', strokeWidth: 2.2 } as const;
export const LOGO_MARK_ARROW = { d: 'M10.9 4.6 13 2.5l2.1 2.1', strokeWidth: 1.8 } as const;

/** The glyph as a standalone SVG document, for an `<img>` data URI. */
export function logoMarkSvg(color: string) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${LOGO_MARK_VIEW_BOX}" fill="none">` +
    `<path d="${LOGO_MARK_ARCH.d}" stroke="${color}" stroke-linecap="round" stroke-width="${LOGO_MARK_ARCH.strokeWidth}"/>` +
    `<path d="${LOGO_MARK_ARROW.d}" stroke="${color}" stroke-linecap="round" stroke-linejoin="round" stroke-width="${LOGO_MARK_ARROW.strokeWidth}"/>` +
    '</svg>'
  );
}
