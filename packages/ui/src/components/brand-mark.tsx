import { BRAND_MARK_FACETS, BRAND_MARK_VIEW_BOX, type BrandMarkFacet } from "@workspace/tokens";
import * as React from "react";

export interface BrandMarkProps extends Omit<React.SVGProps<SVGSVGElement>, "viewBox" | "children"> {
	/**
	 * The accessible name when the mark stands alone (a link to home). Leave it
	 * out when a brand name is written next to it: the mark is then decorative.
	 */
	readonly label?: string;
}

/**
 * The brand mark (ADR 040): an isometric cube in three facets, drawn from
 * packages/tokens `BRAND_MARK_FACETS` — the same data the favicon and the Expo
 * app use. One colour, `currentColor`, at each facet's strength, so it takes
 * the colour of its context (`text-auth-panel-foreground` on the sign-in tile,
 * `text-primary` in the sidebar). Size it with `className` (`size-5`).
 */
export const BrandMark = React.forwardRef<SVGSVGElement, BrandMarkProps>(function BrandMark({ label, ...props }, ref): React.JSX.Element {
	const accessibility = label === undefined ? { "aria-hidden": true } : { role: "img", "aria-label": label };
	return (
		<svg ref={ref} data-slot="brand-mark" viewBox={BRAND_MARK_VIEW_BOX} fill="currentColor" {...accessibility} {...props}>
			{BRAND_MARK_FACETS.map((facet: BrandMarkFacet): React.JSX.Element => (
				<path key={facet.name} d={facet.path} fillOpacity={facet.opacity} />
			))}
		</svg>
	);
});
