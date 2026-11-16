import { Button } from "@workspace/ui-native/components/button";
import { EmptyState } from "@workspace/ui-native/components/empty";
import * as React from "react";
import { View } from "react-native";
import Svg, { Circle, Line, Rect } from "react-native-svg";

import { ignorePress } from "../example-support";
import { useIllustrationColors } from "./illustration";

/** The drawing: the web's, in the theme's colours (nothing until they resolve). Decorative. */
function NodesIllustration(): React.JSX.Element | null {
	const colors = useIllustrationColors();
	if (colors === null) {
		return null;
	}
	return (
		<Svg accessibilityElementsHidden importantForAccessibility="no-hide-descendants" width="200" height="120" viewBox="0 0 200 120" fill="none">
			<Line x1="100" y1="60" x2="44" y2="30" stroke={colors.border} strokeWidth="1.5" strokeDasharray="4 3" />
			<Line x1="100" y1="60" x2="44" y2="90" stroke={colors.border} strokeWidth="1.5" strokeDasharray="4 3" />
			<Line x1="100" y1="60" x2="156" y2="30" stroke={colors.border} strokeWidth="1.5" strokeDasharray="4 3" />
			<Line x1="100" y1="60" x2="156" y2="90" stroke={colors.border} strokeWidth="1.5" strokeDasharray="4 3" />
			<Circle cx="100" cy="60" r="18" fill={colors.primary} fillOpacity={0.1} stroke={colors.primary} strokeOpacity={0.4} strokeWidth="1.5" />
			<Circle cx="100" cy="60" r="6" fill={colors.primary} fillOpacity={0.3} />
			<Circle cx="100" cy="60" r="2.5" fill={colors.primary} />
			<Circle cx="44" cy="30" r="14" fill={colors.muted} stroke={colors.border} strokeWidth="1.5" />
			<Rect x="37" y="26" width="14" height="3" rx="1.5" fill={colors.mutedForeground} fillOpacity={0.2} />
			<Rect x="40" y="32" width="8" height="2" rx="1" fill={colors.mutedForeground} fillOpacity={0.12} />
			<Circle cx="44" cy="90" r="14" fill={colors.muted} stroke={colors.border} strokeWidth="1.5" />
			<Rect x="37" y="86" width="14" height="3" rx="1.5" fill={colors.mutedForeground} fillOpacity={0.2} />
			<Rect x="40" y="92" width="8" height="2" rx="1" fill={colors.mutedForeground} fillOpacity={0.12} />
			<Circle cx="156" cy="30" r="14" fill={colors.muted} stroke={colors.border} strokeWidth="1.5" />
			<Rect x="149" y="26" width="14" height="3" rx="1.5" fill={colors.mutedForeground} fillOpacity={0.2} />
			<Rect x="152" y="32" width="8" height="2" rx="1" fill={colors.mutedForeground} fillOpacity={0.12} />
			<Circle cx="156" cy="90" r="14" fill={colors.muted} stroke={colors.border} strokeWidth="1.5" />
			<Rect x="149" y="86" width="14" height="3" rx="1.5" fill={colors.mutedForeground} fillOpacity={0.2} />
			<Rect x="152" y="92" width="8" height="2" rx="1" fill={colors.mutedForeground} fillOpacity={0.12} />
			<Circle cx="72" cy="40" r="2" fill={colors.primary} fillOpacity={0.15} />
			<Circle cx="128" cy="80" r="2" fill={colors.primary} fillOpacity={0.15} />
			<Circle cx="72" cy="80" r="1.5" fill={colors.mutedForeground} fillOpacity={0.1} />
			<Circle cx="128" cy="40" r="1.5" fill={colors.mutedForeground} fillOpacity={0.1} />
		</Svg>
	);
}

const ILLUSTRATION = <NodesIllustration />;

export function Empty19Example(): React.JSX.Element {
	return (
		<EmptyState
			variant="plain"
			align="center"
			illustration={ILLUSTRATION}
			title="No integrations"
			message="Connect your tools and services to streamline your workflow."
			className="py-12">
			<View className="flex-row gap-2">
				<Button label="Browse integrations" size="sm" onPress={ignorePress} />
				<Button label="Learn more" variant="outline" size="sm" onPress={ignorePress} />
			</View>
		</EmptyState>
	);
}
