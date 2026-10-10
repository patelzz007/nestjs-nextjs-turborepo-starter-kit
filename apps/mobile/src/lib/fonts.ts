// The app's typefaces, the same as the web's (packages/ui src/fonts, ADR 037):
// Geist for the UI and running text, Bricolage Grotesque for headings, Geist
// Mono for codes and IDs.
//
// React Native picks a font by FAMILY NAME, not by weight: a custom font has
// no "semibold" unless that weight is loaded as its own family. So every
// weight the app uses is one entry here, and global.css gives each one a
// utility (`font-sans`, `font-sans-semibold`, `font-heading`, `font-mono`, …)
// whose value is the entry's key. Weight utilities (`font-semibold`) are not
// used on mobile — they would fake a bold or fall back to the system font.
//
// Each weight is imported by path, so only these files are bundled.

import { BricolageGrotesque_600SemiBold } from "@expo-google-fonts/bricolage-grotesque/600SemiBold";
import { Geist_400Regular } from "@expo-google-fonts/geist/400Regular";
import { Geist_500Medium } from "@expo-google-fonts/geist/500Medium";
import { Geist_600SemiBold } from "@expo-google-fonts/geist/600SemiBold";
import { Geist_700Bold } from "@expo-google-fonts/geist/700Bold";
import { GeistMono_400Regular } from "@expo-google-fonts/geist-mono/400Regular";
import { useFonts } from "expo-font";

/**
 * Every font file the app loads, by the family name it is registered under.
 * Keep in step with the `@theme` font utilities in global.css.
 */
export const APP_FONTS = {
	Geist_400Regular,
	Geist_500Medium,
	Geist_600SemiBold,
	Geist_700Bold,
	BricolageGrotesque_600SemiBold,
	GeistMono_400Regular,
} satisfies Readonly<Record<string, number>>;

/**
 * Loads the app's fonts. `true` once they are ready — or once loading failed,
 * in which case text falls back to the system font instead of the splash
 * screen staying up forever.
 */
export function useAppFonts(): boolean {
	const [loaded, error] = useFonts(APP_FONTS);
	return loaded || error !== null;
}
