// ============================================
// autofill-highlight.ts - an Expo config plugin for Android text fields
// ============================================
// When Android's autofill fills a field (an email, a password), the system
// paints a yellow highlight over it until the text changes. It is drawn by
// Android, not by the app, so no style on the input can remove it, and it
// clashes with every theme (dark and Nord worst: yellow over a dark field).
// The highlight is the theme attribute `android:autofilledHighlight` (API 26+);
// this plugin sets it to transparent in the app's theme (AppTheme in the
// generated styles.xml), so an autofilled field looks like any other field in
// every theme. Autofill itself keeps working.
//
// Registered in app config `plugins`; it runs when the native project is
// generated (`expo prebuild`, `expo run:android`, EAS Build). Expo Go never
// reads it, so the highlight still shows there.

import { AndroidConfig, withAndroidStyles, type ConfigPlugin } from "expo/config-plugins";

/** The theme attribute Android draws over an autofilled field. */
export const AUTOFILLED_HIGHLIGHT_ITEM = "android:autofilledHighlight";

/** No highlight: a transparent drawable. */
export const NO_HIGHLIGHT = "@android:color/transparent";

/** The styles with the app theme's autofill highlight turned off (added once, or replacing an earlier value). */
export function withoutAutofillHighlight(styles: AndroidConfig.Resources.ResourceXML): AndroidConfig.Resources.ResourceXML {
	return AndroidConfig.Styles.assignStylesValue(styles, {
		add: true,
		parent: AndroidConfig.Styles.getAppThemeGroup(),
		name: AUTOFILLED_HIGHLIGHT_ITEM,
		value: NO_HIGHLIGHT,
	});
}

export const withAutofillHighlightRemoved: ConfigPlugin = (config) =>
	withAndroidStyles(config, (modConfig) => {
		modConfig.modResults = withoutAutofillHighlight(modConfig.modResults);
		return modConfig;
	});

export default withAutofillHighlightRemoved;
