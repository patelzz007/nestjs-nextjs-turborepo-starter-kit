// The languages of a codebase, as GitHub shows them: one bar split by each
// language's share in the language's own colour, then a row per language — its
// logo, its name and its share. The rows carry every number as text, so the
// bar's colours are never the only way to tell the languages apart.
//
// Presentational: the caller orders the languages, resolves each one's logo
// and colours and formats the shares.

import * as React from "react";
import { Text, View } from "react-native";

import { LanguageLogo } from "./language-logo";

export interface LanguageShare {
	readonly name: string;
	/** Share of the code, 0–100: how wide its part of the bar is. */
	readonly percent: number;
	/** The share as shown ("82.4%"). */
	readonly percentLabel: string;
	/** The language's colour (`#rrggbb`) for its part of the bar; `null` draws it muted. */
	readonly color: string | null;
	/** The logo tile's background (the colour softened, `#rrggbbaa`); `null` for the muted surface. */
	readonly tint: string | null;
	/** The logo's SVG path in a 24 × 24 box; `null` when the language has none. */
	readonly logoPath: string | null;
	/** Stands in for a missing logo ("C#"). */
	readonly monogram: string;
}

export interface LanguageBreakdownProps {
	/** What the bar shows ("Languages"): its accessible name. */
	readonly title: string;
	readonly languages: readonly LanguageShare[];
	readonly testID?: string;
}

export function LanguageBreakdown({ title, languages, testID }: LanguageBreakdownProps): React.JSX.Element {
	const filled = languages.filter((language: LanguageShare): boolean => language.percent > 0);
	const summary = languages.map((language: LanguageShare): string => `${language.name} ${language.percentLabel}`).join(", ");
	return (
		<View className="gap-3" testID={testID}>
			<View className="h-2 flex-row gap-0.5 overflow-hidden rounded-full bg-muted" accessible accessibilityLabel={`${title}: ${summary}`}>
				{filled.map((language: LanguageShare): React.JSX.Element => (
					<BarPart key={language.name} language={language} />
				))}
			</View>
			<View className="gap-2">
				{languages.map((language: LanguageShare): React.JSX.Element => (
					<View key={language.name} className="min-h-8 flex-row items-center gap-3" accessible accessibilityLabel={`${language.name}: ${language.percentLabel}`}>
						<LanguageLogo path={language.logoPath} monogram={language.monogram} tint={language.tint} testID={`language-logo-${language.name}`} />
						<Text className="font-sans-medium flex-1 text-sm text-foreground">{language.name}</Text>
						<Text className="font-sans text-sm text-muted-foreground">{language.percentLabel}</Text>
					</View>
				))}
			</View>
		</View>
	);
}

interface BarPartProps {
	readonly language: LanguageShare;
}

/** A language's part of the bar, as wide as its share, in its colour. */
function BarPart({ language }: BarPartProps): React.JSX.Element {
	const style = React.useMemo(
		(): { readonly flexGrow: number; readonly backgroundColor?: string } =>
			language.color === null ? { flexGrow: language.percent } : { flexGrow: language.percent, backgroundColor: language.color },
		[language.color, language.percent],
	);
	return <View style={style} className={`basis-0 ${language.color === null ? "bg-muted-foreground" : ""}`} testID={`language-bar-${language.name}`} />;
}
