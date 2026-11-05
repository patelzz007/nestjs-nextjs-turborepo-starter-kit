// A programming language's logo on a small tile, the way a language reads at
// a glance. The language's ORIGINAL logo — its brand's own colours (devicon) —
// sits on a light chip (`bg-logo-tile`, light in every theme, so a near-black
// logo still reads). A language without one shows its one-colour glyph in the
// foreground colour on a soft tint of the language's colour, and one without
// either a short monogram. Decorative: the language's name is written next to it.

import * as React from "react";
import { Text, View } from "react-native";
import Svg, { Path, SvgXml } from "react-native-svg";
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

/** Side of an original logo inside its 32 pt chip, in points. */
const ORIGINAL_LOGO_SIZE = 20;

export interface LanguageLogoProps {
	/** The original (full-colour) logo as an SVG document; `null` for the glyph or the monogram. */
	readonly original: string | null;
	/** The logo's SVG path in a 24 × 24 box; `null` draws the monogram. */
	readonly path: string | null;
	/** One or two characters standing in for a language without a logo ("C#"). */
	readonly monogram: string;
	/** The tile's background: the language's colour, softened (`#rrggbbaa`); `null` for the muted surface. */
	readonly tint: string | null;
	readonly testID?: string;
}

export function LanguageLogo({ original, path, monogram, tint, testID }: LanguageLogoProps): React.JSX.Element {
	const tileStyle = React.useMemo((): { readonly backgroundColor: string } | undefined => (tint === null ? undefined : { backgroundColor: tint }), [tint]);
	if (original !== null) {
		return (
			<View className="bg-logo-tile size-8 items-center justify-center rounded-lg" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden testID={testID}>
				<SvgXml xml={original} width={ORIGINAL_LOGO_SIZE} height={ORIGINAL_LOGO_SIZE} {...(testID === undefined ? {} : { testID: `${testID}-original` })} />
			</View>
		);
	}
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
