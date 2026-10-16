import type * as React from "react";

/**
 * One worked example of a kit component on the `/components` page — a small,
 * self-contained usage (its own demo state, sample data only, no API calls),
 * ported from the reui registry's examples for that component.
 */
export interface GalleryExample {
	/** Stable id: the registry example it was ported from (`c-button-12`). */
	readonly id: string;
	/** Short title shown above the example ("Loading state"). */
	readonly label: string;
	/** The example, rendered as a component (`<example.component />`) so its hooks stay its own. */
	readonly component: React.ComponentType;
}
