// The brand mark (ADR 040): an isometric cube in three facets, drawn from
// packages/tokens `BRAND_MARK_FACETS` — the same data as the web `BrandMark` and
// every favicon. One colour at each facet's strength, set with an `accent-*`
// token utility through `colorClassName`. Decorative: the brand name is
// written next to it.

import { BRAND_MARK_FACETS, BRAND_MARK_VIEW_BOX, type BrandMarkFacet } from "@workspace/tokens";
import * as React from "react";
import Svg, { Path } from "react-native-svg";
import { withUniwind } from "uniwind";

interface MarkProps {
	readonly size: number;
	/** Filled in by Uniwind from `colorClassName`; unresolved, the mark keeps the default colour. */
	readonly color?: string | undefined;
	readonly testID?: string | undefined;
}

function Mark({ size, color, testID }: MarkProps): React.JSX.Element {
	return (
		<Svg width={size} height={size} viewBox={BRAND_MARK_VIEW_BOX} {...(color === undefined ? {} : { color })} {...(testID === undefined ? {} : { testID })}>
			{BRAND_MARK_FACETS.map((facet: BrandMarkFacet): React.JSX.Element => (
				<Path key={facet.name} d={facet.path} fill="currentColor" fillOpacity={facet.opacity} />
			))}
		</Svg>
	);
}

/** Maps `colorClassName` (an `accent-*` token utility) onto the mark's `color`. */
const ThemedMark = withUniwind(Mark);

export interface BrandMarkProps {
	/** Side of the mark, in points. */
	readonly size: number;
	/** An `accent-*` token utility: `accent-auth-panel-foreground`, `accent-primary`, … */
	readonly colorClassName: string;
	readonly testID?: string;
}

export function BrandMark({ size, colorClassName, testID }: BrandMarkProps): React.JSX.Element {
	return <ThemedMark size={size} colorClassName={colorClassName} testID={testID} />;
}
