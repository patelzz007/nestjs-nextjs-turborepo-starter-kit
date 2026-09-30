/**
 * Resolves command-palette pinned URLs against a searchable index for the
 * sidebar favorites row. Admin passes the **authorized** index (see
 * `AuthorizedNavigationProvider`), so a pin to a page the user can no longer
 * see simply drops out.
 */
export { resolvePinnedMenuItems } from "@workspace/ui/lib/palette/resolve-pinned-menu-items";
