// Colours for the native navigation chrome (tab bar), which takes colour values
// instead of class names. They come from the same design tokens through
// Uniwind's CSS variables, so they follow the theme (ADR 030, ADR 032).

import { useCSSVariable } from "uniwind";
import { z } from "zod";

export interface NavigationColors {
	readonly background: string | undefined;
	readonly border: string | undefined;
	readonly active: string | undefined;
	readonly inactive: string | undefined;
}

const ColorValueSchema = z.string();

function colorOf(value: string | number | undefined): string | undefined {
	return ColorValueSchema.safeParse(value).data;
}

export function useNavigationColors(): NavigationColors {
	const background = useCSSVariable("--card");
	const border = useCSSVariable("--border");
	const active = useCSSVariable("--primary");
	const inactive = useCSSVariable("--muted-foreground");
	return { background: colorOf(background), border: colorOf(border), active: colorOf(active), inactive: colorOf(inactive) };
}
