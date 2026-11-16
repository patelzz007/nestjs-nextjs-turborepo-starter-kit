import { Button } from "@workspace/ui-native/components/button";
import { EmptyState } from "@workspace/ui-native/components/empty";
import * as React from "react";
import Svg, { Circle, Path, Polygon, Rect } from "react-native-svg";

import { ignorePress } from "../example-support";
import { useIllustrationColors } from "./illustration";

/** The drawing: the web's, in the theme's colours (nothing until they resolve). Decorative. */
function AutomationIllustration(): React.JSX.Element | null {
	const colors = useIllustrationColors();
	if (colors === null) {
		return null;
	}
	return (
		<Svg accessibilityElementsHidden importantForAccessibility="no-hide-descendants" width="200" height="120" viewBox="0 0 200 120" fill="none">
			<Path d="M30 60 L68 60" stroke={colors.mutedForeground} strokeOpacity={0.3} strokeWidth="2" strokeLinecap="round" />
			<Polygon points="66,56 74,60 66,64" fill={colors.mutedForeground} fillOpacity={0.3} />
			<Rect x="76" y="42" width="56" height="36" rx="18" fill={colors.primary} fillOpacity={0.05} stroke={colors.primary} strokeOpacity={0.6} strokeWidth="2" />
			<Circle cx="94" cy="60" r="12" fill={colors.primary} fillOpacity={0.4} />
			<Circle cx="94" cy="60" r="6" fill={colors.primary} />
			<Path d="M134 60 Q150 60 158 48" stroke={colors.mutedForeground} strokeOpacity={0.3} strokeWidth="2" fill="none" strokeLinecap="round" />
			<Circle cx="162" cy="44" r="3" fill={colors.mutedForeground} fillOpacity={0.2} />
			<Path d="M134 60 Q150 60 158 72" stroke={colors.mutedForeground} strokeOpacity={0.3} strokeWidth="2" fill="none" strokeLinecap="round" />
			<Circle cx="162" cy="76" r="3" fill={colors.mutedForeground} fillOpacity={0.2} />
			<Circle cx="22" cy="60" r="2" fill={colors.mutedForeground} fillOpacity={0.2} />
			<Circle cx="174" cy="44" r="2" fill={colors.mutedForeground} fillOpacity={0.15} />
			<Circle cx="174" cy="76" r="2" fill={colors.mutedForeground} fillOpacity={0.15} />
		</Svg>
	);
}

const ILLUSTRATION = <AutomationIllustration />;

export function Empty13Example(): React.JSX.Element {
	return (
		<EmptyState
			variant="plain"
			align="center"
			illustration={ILLUSTRATION}
			title="No automations yet"
			message="Hook up your favorite tools and let the automation magic begin."
			className="py-12">
			<Button label="Create new automation" size="sm" onPress={ignorePress} />
		</EmptyState>
	);
}
