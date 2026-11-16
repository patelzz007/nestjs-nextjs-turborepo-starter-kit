// What the Card examples share: the web examples' sample photos (served from images.unsplash.com, the
// same sources) and a scrim fade for text laid over a photo, in the theme's scrim colour.

import * as React from "react";
import { View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useCSSVariable } from "uniwind";
import { z } from "zod";

const UNSPLASH_PARAMS = "?auto=format&fit=crop&w=1000&h=800&q=80";

/** Abstract sample photos the examples share. */
export const CARD_PHOTOS: Readonly<Record<"gradient" | "waves" | "fluid" | "prism", string>> = {
	gradient: `https://images.unsplash.com/photo-1579546929518-9e396f3cc809${UNSPLASH_PARAMS}`,
	waves: `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe${UNSPLASH_PARAMS}`,
	fluid: `https://images.unsplash.com/photo-1620641788421-7a1c342ea42e${UNSPLASH_PARAMS}`,
	prism: `https://images.unsplash.com/photo-1620121692029-d088224ddc74${UNSPLASH_PARAMS}`,
};

/** Sample people's portraits. */
export const SAMPLE_PORTRAITS: Readonly<Record<"james" | "sofia" | "marco" | "emma", string>> = {
	james: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=96&h=96&dpr=2&q=80",
	sofia: "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=96&h=96&dpr=2&q=80",
	marco: "https://images.unsplash.com/photo-1584308972272-9e4e7685e80f?w=96&h=96&dpr=2&q=80",
	emma: "https://images.unsplash.com/photo-1485893086445-ed75865251e0?w=96&h=96&dpr=2&q=80",
};

const ColorSchema = z.string();
/** How dark the scrim is at its edge: the web's `from-scrim/60`. */
const SCRIM_OPACITY = 0.6;

/** A fade from the scrim colour at `edge` to clear, so text over a photo stays readable. Decorative. */
export function CardScrim({ edge, className }: { readonly edge: "top" | "bottom"; readonly className: string }): React.JSX.Element {
	const scrim = ColorSchema.safeParse(useCSSVariable("--color-scrim")).data;
	const id = `card-scrim-${edge}`;
	return (
		<View pointerEvents="none" className={className}>
			{scrim === undefined ? null : (
				<Svg width="100%" height="100%">
					<Defs>
						<LinearGradient id={id} x1="0" y1={edge === "top" ? "0" : "1"} x2="0" y2={edge === "top" ? "1" : "0"}>
							<Stop offset="0" stopColor={scrim} stopOpacity={SCRIM_OPACITY} />
							<Stop offset="1" stopColor={scrim} stopOpacity={0} />
						</LinearGradient>
					</Defs>
					<Rect width="100%" height="100%" fill={`url(#${id})`} />
				</Svg>
			)}
		</View>
	);
}
