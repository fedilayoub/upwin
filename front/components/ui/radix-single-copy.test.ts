import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Overlays that nest inside each other must load one copy of Radix's
 * focus-scope and dismissable-layer. Two copies keep two layer stacks, so a
 * Sheet's focus trap never pauses for a Popover opened inside it: focus is
 * pulled back into the Sheet and the Popover closes on the first click. That
 * is how the goal form's chip pickers broke.
 */
const NESTED_OVERLAYS = ['dialog.tsx', 'sheet.tsx', 'popover.tsx'];

describe('Radix overlay wrappers', () => {
  it.each(NESTED_OVERLAYS)('%s imports from the radix-ui umbrella package', (file) => {
    const source = readFileSync(join(__dirname, file), 'utf8');
    expect(source).toMatch(/from "radix-ui"/);
    expect(source).not.toMatch(/from "@radix-ui\/react-(dialog|popover)"/);
  });
});
