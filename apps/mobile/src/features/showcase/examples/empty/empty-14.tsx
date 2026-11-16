import { EmptyState } from "@workspace/ui-native/components/empty";
import * as React from "react";
import Svg, { Circle, Ellipse, Line, Path } from "react-native-svg";

import { useIllustrationColors } from "./illustration";

/** The drawing: the web's, in the theme's colours (nothing until they resolve). Decorative. */
function BoardIllustration(): React.JSX.Element | null {
	const colors = useIllustrationColors();
	if (colors === null) {
		return null;
	}
	return (
		<Svg accessibilityElementsHidden importantForAccessibility="no-hide-descendants" width="180" height="160" viewBox="0 0 180 160" fill="none">
			<Ellipse cx="90" cy="148" rx="60" ry="8" fill={colors.mutedForeground} fillOpacity={0.08} />
			<Path d="M30 40 L90 10 L160 45 L100 75 Z" fill={colors.muted} fillOpacity={0.8} stroke={colors.border} strokeWidth="1.5" strokeLinejoin="round" />
			<Path d="M30 40 L100 75 L100 110 L30 75 Z" fill={colors.muted} stroke={colors.border} strokeWidth="1.5" strokeLinejoin="round" />
			<Path d="M100 75 L160 45 L160 80 L100 110 Z" fill={colors.background} stroke={colors.border} strokeWidth="1.5" strokeLinejoin="round" />
			<Circle cx="62" cy="35" r="4" fill={colors.primary} fillOpacity={0.2} />
			<Line x1="72" y1="33" x2="105" y2="17" stroke={colors.mutedForeground} strokeOpacity={0.2} strokeWidth="4" strokeLinecap="round" />
			<Line x1="110" y1="15" x2="130" y2="5" stroke={colors.mutedForeground} strokeOpacity={0.15} strokeWidth="4" strokeLinecap="round" />
			<Circle cx="55" cy="50" r="4" fill={colors.primary} fillOpacity={0.3} />
			<Line x1="65" y1="48" x2="100" y2="31" stroke={colors.mutedForeground} strokeOpacity={0.2} strokeWidth="4" strokeLinecap="round" />
			<Line x1="105" y1="29" x2="135" y2="14" stroke={colors.mutedForeground} strokeOpacity={0.12} strokeWidth="4" strokeLinecap="round" />
			<Circle cx="48" cy="65" r="4" fill={colors.destructive} fillOpacity={0.25} />
			<Line x1="58" y1="63" x2="88" y2="48" stroke={colors.mutedForeground} strokeOpacity={0.18} strokeWidth="4" strokeLinecap="round" />
		</Svg>
	);
}

const ILLUSTRATION = <BoardIllustration />;

export function Empty14Example(): React.JSX.Element {
	return (
		<EmptyState
			variant="plain"
			align="center"
			illustration={ILLUSTRATION}
			title="Be the first to share a thought"
			message="Drop a comment on the canvas to get the conversation started."
			className="py-12"
		/>
	);
}
