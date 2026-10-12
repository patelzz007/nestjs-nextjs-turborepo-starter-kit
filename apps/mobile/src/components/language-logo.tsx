// A programming language's logo on a small tile, the way a language reads at
// a glance: the logo in the foreground colour (legible in both themes, whatever
// the language's own colour), on a soft tint of the language's colour. A
// language without a logo shows a short monogram instead. Decorative: the
// language's name is written next to it.

import * as React from "react";
import { Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { withUniwind } from "uniwind";

/** Logos are drawn in a 24-unit box (Simple Icons' grid). */
const LOGO_VIEW_BOX = "0 0 24 24";
/** Side of the logo inside its 32 pt tile, in points. */
const LOGO_SIZE = 18;

interface GlyphProps {
	readonly path: string;
	/** Filled in by Uniwind from `colorClassName`. */
	readonly color?: string | undefined;
}

function Glyph({ path, color }: GlyphProps): React.JSX.Element {
	return (
		<Svg width={LOGO_SIZE} height={LOGO_SIZE} viewBox={LOGO_VIEW_BOX} {...(color === undefined ? {} : { color })}>
			<Path d={path} fill="currentColor" />
		</Svg>
	);
}

/** Maps `colorClassName` (an `accent-*` token utility) onto the glyph's `color`. */
const ThemedGlyph = withUniwind(Glyph);

export interface LanguageLogoProps {
	/** The logo's SVG path in a 24 × 24 box; `null` draws the monogram. */
	readonly path: string | null;
	/** One or two characters standing in for a language without a logo ("C#"). */
	readonly monogram: string;
	/** The tile's background: the language's colour, softened (`#rrggbbaa`); `null` for the muted surface. */
	readonly tint: string | null;
	readonly testID?: string;
}

export function LanguageLogo({ path, monogram, tint, testID }: LanguageLogoProps): React.JSX.Element {
	const tileStyle = React.useMemo((): { readonly backgroundColor: string } | undefined => (tint === null ? undefined : { backgroundColor: tint }), [tint]);
	return (
		<View
			style={tileStyle}
			className={`size-8 items-center justify-center rounded-lg ${tint === null ? "bg-muted" : ""}`}
			importantForAccessibility="no-hide-descendants"
			accessibilityElementsHidden
			testID={testID}>
			{path === null ? <Text className="font-mono text-xs text-foreground">{monogram}</Text> : <ThemedGlyph path={path} colorClassName="accent-foreground" />}
		</View>
	);
}
