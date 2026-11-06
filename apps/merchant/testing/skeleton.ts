import { screen } from "@testing-library/react";

/**
 * What every busy loading region on screen (a `SkeletonRegion`: `role="status"`,
 * `aria-busy="true"`) announces, in document order — so a test pins exactly
 * which surfaces are loading and what each one tells a screen reader.
 */
export function busyRegionAnnouncements(): readonly (string | null)[] {
	return screen
		.queryAllByRole("status")
		.filter((status: HTMLElement): boolean => status.getAttribute("aria-busy") === "true")
		.map((status: HTMLElement): string | null => status.textContent);
}
