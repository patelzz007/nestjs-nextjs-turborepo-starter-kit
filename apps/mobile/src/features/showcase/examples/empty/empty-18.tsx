import { Button } from "@workspace/ui-native/components/button";
import { EmptyState } from "@workspace/ui-native/components/empty";
import * as React from "react";
import Svg, { Circle, G, Line, Path, Rect } from "react-native-svg";

import { ignorePress } from "../example-support";
import { useIllustrationColors } from "./illustration";

/** The drawing: the web's, in the theme's colours (nothing until they resolve). Decorative. */
function CreditCardIllustration(): React.JSX.Element | null {
	const colors = useIllustrationColors();
	if (colors === null) {
		return null;
	}
	return (
		<Svg accessibilityElementsHidden importantForAccessibility="no-hide-descendants" width="200" height="130" viewBox="0 0 200 130" fill="none">
			<Rect x="48" y="12" width="120" height="78" rx="10" fill={colors.muted} fillOpacity={0.5} transform="rotate(6 108 51)" />
			<Rect x="36" y="18" width="128" height="82" rx="10" fill={colors.background} stroke={colors.border} strokeWidth="1.5" />
			<Rect x="52" y="38" width="22" height="16" rx="3" fill={colors.mutedForeground} fillOpacity={0.15} stroke={colors.mutedForeground} strokeOpacity={0.2} strokeWidth="1" />
			<Line x1="52" y1="46" x2="74" y2="46" stroke={colors.mutedForeground} strokeOpacity={0.15} strokeWidth="0.8" />
			<Line x1="63" y1="38" x2="63" y2="54" stroke={colors.mutedForeground} strokeOpacity={0.15} strokeWidth="0.8" />
			<G stroke={colors.mutedForeground} strokeOpacity={0.2} strokeWidth="1.5" fill="none">
				<Path d="M84 42 Q87 46 84 50" strokeLinecap="round" />
				<Path d="M88 40 Q92 46 88 52" strokeLinecap="round" />
				<Path d="M92 38 Q97 46 92 54" strokeLinecap="round" />
			</G>
			<G fill={colors.mutedForeground} fillOpacity={0.2}>
				<Circle cx="56" cy="68" r="2" />
				<Circle cx="64" cy="68" r="2" />
				<Circle cx="72" cy="68" r="2" />
				<Circle cx="80" cy="68" r="2" />
			</G>
			<G fill={colors.mutedForeground} fillOpacity={0.15}>
				<Circle cx="94" cy="68" r="2" />
				<Circle cx="102" cy="68" r="2" />
				<Circle cx="110" cy="68" r="2" />
				<Circle cx="118" cy="68" r="2" />
			</G>
			<Rect x="52" y="80" width="40" height="3" rx="1.5" fill={colors.mutedForeground} fillOpacity={0.12} />
			<Rect x="120" y="80" width="28" height="3" rx="1.5" fill={colors.mutedForeground} fillOpacity={0.12} />
			<Circle cx="140" cy="88" r="6" fill={colors.mutedForeground} fillOpacity={0.08} />
			<Circle cx="150" cy="88" r="6" fill={colors.mutedForeground} fillOpacity={0.12} />
			<Circle cx="26" cy="50" r="3" fill={colors.primary} fillOpacity={0.1} />
			<Circle cx="180" cy="40" r="2" fill={colors.primary} fillOpacity={0.1} />
			<Path d="M174 70 L178 66 L178 74 Z" fill={colors.mutedForeground} fillOpacity={0.1} />
		</Svg>
	);
}

const ILLUSTRATION = <CreditCardIllustration />;

export function Empty18Example(): React.JSX.Element {
	return (
		<EmptyState
			variant="plain"
			align="center"
			illustration={ILLUSTRATION}
			title="No payment methods"
			message="Add a payment method to start making transactions securely."
			className="py-12">
			<Button label="Add payment method" size="sm" onPress={ignorePress} />
		</EmptyState>
	);
}
