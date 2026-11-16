import { Button } from "@workspace/ui-native/components/button";
import { EmptyState } from "@workspace/ui-native/components/empty";
import * as React from "react";
import Svg, { Circle, Line, Rect } from "react-native-svg";

import { ignorePress } from "../example-support";
import { useIllustrationColors } from "./illustration";

/** The drawing: the web's, in the theme's colours (nothing until they resolve). Decorative. */
function CalendarIllustration(): React.JSX.Element | null {
	const colors = useIllustrationColors();
	if (colors === null) {
		return null;
	}
	return (
		<Svg accessibilityElementsHidden importantForAccessibility="no-hide-descendants" width="160" height="140" viewBox="0 0 160 140" fill="none">
			<Rect x="24" y="28" width="112" height="96" rx="10" fill={colors.background} stroke={colors.border} strokeWidth="1.5" />
			<Rect x="24" y="28" width="112" height="24" rx="10" fill={colors.muted} />
			<Rect x="24" y="42" width="112" height="10" fill={colors.muted} />
			<Line x1="56" y1="20" x2="56" y2="36" stroke={colors.mutedForeground} strokeOpacity={0.3} strokeWidth="3" strokeLinecap="round" />
			<Line x1="104" y1="20" x2="104" y2="36" stroke={colors.mutedForeground} strokeOpacity={0.3} strokeWidth="3" strokeLinecap="round" />
			<Circle cx="48" cy="68" r="4" fill={colors.mutedForeground} fillOpacity={0.1} />
			<Circle cx="68" cy="68" r="4" fill={colors.mutedForeground} fillOpacity={0.1} />
			<Circle cx="88" cy="68" r="4" fill={colors.mutedForeground} fillOpacity={0.1} />
			<Circle cx="108" cy="68" r="4" fill={colors.mutedForeground} fillOpacity={0.1} />
			<Circle cx="48" cy="86" r="4" fill={colors.mutedForeground} fillOpacity={0.1} />
			<Circle cx="68" cy="86" r="4" fill={colors.mutedForeground} fillOpacity={0.1} />
			<Circle cx="88" cy="86" r="4" fill={colors.primary} fillOpacity={0.25} />
			<Circle cx="88" cy="86" r="2" fill={colors.primary} />
			<Circle cx="108" cy="86" r="4" fill={colors.mutedForeground} fillOpacity={0.1} />
			<Circle cx="48" cy="104" r="4" fill={colors.mutedForeground} fillOpacity={0.1} />
			<Circle cx="68" cy="104" r="4" fill={colors.mutedForeground} fillOpacity={0.1} />
			<Circle cx="88" cy="104" r="4" fill={colors.mutedForeground} fillOpacity={0.1} />
			<Circle cx="108" cy="104" r="4" fill={colors.mutedForeground} fillOpacity={0.1} />
			<Circle cx="14" cy="70" r="2" fill={colors.mutedForeground} fillOpacity={0.1} />
			<Circle cx="148" cy="56" r="2.5" fill={colors.primary} fillOpacity={0.1} />
			<Circle cx="146" cy="100" r="1.5" fill={colors.mutedForeground} fillOpacity={0.08} />
		</Svg>
	);
}

const ILLUSTRATION = <CalendarIllustration />;

export function Empty20Example(): React.JSX.Element {
	return (
		<EmptyState
			variant="plain"
			align="center"
			illustration={ILLUSTRATION}
			title="No upcoming events"
			message="Your schedule is clear. Create an event to get started."
			className="py-12">
			<Button label="Create event" size="sm" onPress={ignorePress} />
		</EmptyState>
	);
}
