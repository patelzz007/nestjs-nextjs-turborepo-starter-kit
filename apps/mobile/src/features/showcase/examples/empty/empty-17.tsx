import { Button } from "@workspace/ui-native/components/button";
import { EmptyState } from "@workspace/ui-native/components/empty";
import * as React from "react";
import Svg, { Circle, Path, Rect } from "react-native-svg";

import { ignorePress } from "../example-support";
import { useIllustrationColors } from "./illustration";

/** The drawing: the web's, in the theme's colours (nothing until they resolve). Decorative. */
function ChatIllustration(): React.JSX.Element | null {
	const colors = useIllustrationColors();
	if (colors === null) {
		return null;
	}
	return (
		<Svg accessibilityElementsHidden importantForAccessibility="no-hide-descendants" width="180" height="120" viewBox="0 0 180 120" fill="none">
			<Rect x="20" y="20" width="80" height="44" rx="12" fill={colors.muted} stroke={colors.border} strokeWidth="1.5" />
			<Path d="M36 64 L32 76 L48 64" fill={colors.muted} stroke={colors.border} strokeWidth="1.5" strokeLinejoin="round" />
			<Rect x="32" y="32" width="48" height="4" rx="2" fill={colors.mutedForeground} fillOpacity={0.2} />
			<Rect x="32" y="42" width="36" height="4" rx="2" fill={colors.mutedForeground} fillOpacity={0.15} />
			<Circle cx="32" cy="52" r="3" fill={colors.mutedForeground} fillOpacity={0.12} />
			<Rect x="80" y="50" width="80" height="40" rx="12" fill={colors.primary} fillOpacity={0.1} stroke={colors.primary} strokeOpacity={0.3} strokeWidth="1.5" />
			<Path d="M144 90 L148 100 L132 90" fill={colors.primary} fillOpacity={0.1} stroke={colors.primary} strokeOpacity={0.3} strokeWidth="1.5" strokeLinejoin="round" />
			<Rect x="92" y="62" width="52" height="4" rx="2" fill={colors.primary} fillOpacity={0.2} />
			<Rect x="92" y="72" width="32" height="4" rx="2" fill={colors.primary} fillOpacity={0.15} />
			<Circle cx="14" cy="46" r="2" fill={colors.mutedForeground} fillOpacity={0.1} />
			<Circle cx="168" cy="66" r="2" fill={colors.primary} fillOpacity={0.15} />
			<Circle cx="110" cy="16" r="2.5" fill={colors.mutedForeground} fillOpacity={0.1} />
		</Svg>
	);
}

const ILLUSTRATION = <ChatIllustration />;

export function Empty17Example(): React.JSX.Element {
	return (
		<EmptyState
			variant="plain"
			align="center"
			illustration={ILLUSTRATION}
			title="No messages yet"
			message="Start a conversation with your team. Messages will appear here."
			className="py-12">
			<Button label="Send a message" size="sm" onPress={ignorePress} />
		</EmptyState>
	);
}
