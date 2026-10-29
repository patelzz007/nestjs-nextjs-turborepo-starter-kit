import { AndroidConfig } from "expo/config-plugins";
import { z } from "zod";

import withAutofillHighlightRemovedDefault, { AUTOFILLED_HIGHLIGHT_ITEM, NO_HIGHLIGHT, withAutofillHighlightRemoved, withoutAutofillHighlight } from "../autofill-highlight";

/** A generated styles.xml as Expo parses it: the app theme with one item. */
function appStyles(): AndroidConfig.Resources.ResourceXML {
	return {
		resources: {
			style: [
				{
					$: { name: "AppTheme", parent: "Theme.AppCompat.DayNight.NoActionBar" },
					item: [{ $: { name: "colorPrimary" }, _: "@color/colorPrimary" }],
				},
			],
		},
	};
}

/** The app theme's items, by name. */
function appThemeItems(styles: AndroidConfig.Resources.ResourceXML): ReadonlyMap<string, string> {
	const theme = AndroidConfig.Styles.getStylesGroupAsObject(styles, AndroidConfig.Styles.getAppThemeGroup());
	return new Map(Object.entries(theme ?? {}));
}

describe("withoutAutofillHighlight", () => {
	it("sets the app theme's autofill highlight to transparent, and keeps its other items", () => {
		const items = appThemeItems(withoutAutofillHighlight(appStyles()));

		expect(items.get(AUTOFILLED_HIGHLIGHT_ITEM)).toBe(NO_HIGHLIGHT);
		expect(items.get("colorPrimary")).toBe("@color/colorPrimary");
	});

	it("is idempotent across repeated prebuilds: one item", () => {
		const styles = withoutAutofillHighlight(withoutAutofillHighlight(appStyles()));
		const theme = styles.resources.style?.find((style) => style.$.name === "AppTheme");

		expect(theme?.item.filter((item) => item.$.name === AUTOFILLED_HIGHLIGHT_ITEM)).toHaveLength(1);
	});
});

/** A config carrying an Android styles mod (`ExpoConfig`'s type does not declare `mods`). */
const AndroidStylesModSchema = z.object({ mods: z.object({ android: z.object({ styles: z.instanceof(Function) }) }) });

describe("withAutofillHighlightRemoved", () => {
	it("registers an Android styles change, and is the file's default export (the app config loads it by path)", () => {
		const config = withAutofillHighlightRemoved({ name: "Starter", slug: "starter" });

		expect(AndroidStylesModSchema.safeParse(config).success).toBe(true);
		expect(withAutofillHighlightRemovedDefault).toBe(withAutofillHighlightRemoved);
	});
});
