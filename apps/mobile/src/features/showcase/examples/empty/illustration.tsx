// What the empty-state drawings share: the theme's colours for react-native-svg
// (which takes colour values, not classes) and the fade into the screen under
// stacked cards. Read through `useCSSVariable` so light and dark follow the theme.

import * as React from "react";
import { View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useCSSVariable } from "uniwind";
import { z } from "zod";

const ColorSchema = z.string();

/** The theme colours a drawing paints with. */
export interface IllustrationColors {
	readonly primary: string;
	readonly muted: string;
	readonly mutedForeground: string;
	readonly border: string;
	readonly background: string;
	readonly destructive: string;
}

/** The theme's colours, or `null` until the stylesheet resolves them (draw nothing rather than a wrong colour). */
export function useIllustrationColors(): IllustrationColors | null {
	const primary = ColorSchema.safeParse(useCSSVariable("--color-primary")).data;
	const muted = ColorSchema.safeParse(useCSSVariable("--color-muted")).data;
	const mutedForeground = ColorSchema.safeParse(useCSSVariable("--color-muted-foreground")).data;
	const border = ColorSchema.safeParse(useCSSVariable("--color-border")).data;
	const background = ColorSchema.safeParse(useCSSVariable("--color-background")).data;
	const destructive = ColorSchema.safeParse(useCSSVariable("--color-destructive")).data;
	if (primary === undefined || muted === undefined || mutedForeground === undefined || border === undefined || background === undefined || destructive === undefined) {
		return null;
	}
	return { primary, muted, mutedForeground, border, background, destructive };
}

const FADE_ID = "illustration-fade";

/** A fade from clear to the screen's background, laid over the bottom of a drawing. Decorative. */
export function IllustrationFade({ className }: { readonly className: string }): React.JSX.Element {
	const background = ColorSchema.safeParse(useCSSVariable("--color-background")).data;
	return (
		<View pointerEvents="none" className={className}>
			{background === undefined ? null : (
				<Svg width="100%" height="100%">
					<Defs>
						<LinearGradient id={FADE_ID} x1="0" y1="0" x2="0" y2="1">
							<Stop offset="0" stopColor={background} stopOpacity={0} />
							<Stop offset="1" stopColor={background} stopOpacity={1} />
						</LinearGradient>
					</Defs>
					<Rect width="100%" height="100%" fill={`url(#${FADE_ID})`} />
				</Svg>
			)}
		</View>
	);
}
