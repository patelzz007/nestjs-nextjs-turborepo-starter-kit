// Every label pack is complete in every shipped language (ADR 076). The compiler already refuses a
// missing key; this test also fails on an empty string, an extra key, or a function in one language
// that is a plain string in another, and it walks the packs the way the app reads them at runtime.

import { AppLanguageSchema } from "@workspace/shared";

import { APP_LOCK_LABELS } from "../../app-lock/labels";
import { BUILD_INFO_LABELS } from "../../build-info/labels";
import { NAVIGATION_LABELS } from "../../navigation/navigation-labels";
import { PREFERENCES_LABELS } from "../../preferences/labels";
import { APP_LANGUAGE_NAMES, APP_LANGUAGES } from "../app-languages";
import type { LabelPack } from "../label-pack";
import { LabelTreeSchema, type LabelTree } from "../../../../test/label-tree";

/** Every pack the app ships, by name (add a new surface's pack here). */
const PACKS: Readonly<Record<string, LabelPack<object>>> = {
	navigation: NAVIGATION_LABELS,
	preferences: PREFERENCES_LABELS,
	appLock: APP_LOCK_LABELS,
	buildInfo: BUILD_INFO_LABELS,
};

/** Each leaf's path and kind ("text" or "function"); an empty string is reported as "empty". */
function shapeOf(tree: LabelTree, path: string): readonly string[] {
	if (tree.kind === "text") {
		return [`${path}:${tree.value.trim() === "" ? "empty" : "text"}`];
	}
	if (tree.kind === "function") {
		return [`${path}:function`];
	}
	return Object.entries(tree.children).flatMap(([key, child]): readonly string[] => shapeOf(child, `${path}.${key}`));
}

describe("label packs (ADR 076)", () => {
	it("ship the four languages the web apps do", () => {
		expect(APP_LANGUAGES).toEqual(AppLanguageSchema.options);
		expect(Object.keys(APP_LANGUAGE_NAMES)).toEqual(AppLanguageSchema.options);
	});

	it.each(Object.entries(PACKS))("%s has the same keys, none empty, in every language", (_name, pack) => {
		const english = shapeOf(LabelTreeSchema.parse(pack.en), "");
		expect(english.some((leaf: string): boolean => leaf.endsWith(":empty"))).toBe(false);
		for (const language of APP_LANGUAGES) {
			expect(shapeOf(LabelTreeSchema.parse(pack[language]), "")).toEqual(english);
		}
	});

	it("tells a pack with a missing, empty or retyped string from a complete one", () => {
		const english = shapeOf(LabelTreeSchema.parse({ title: "Title", count: (value: number): string => String(value) }), "");
		expect(shapeOf(LabelTreeSchema.parse({ title: "Judul" }), "")).not.toEqual(english);
		expect(shapeOf(LabelTreeSchema.parse({ title: " ", count: (value: number): string => String(value) }), "")).not.toEqual(english);
		expect(shapeOf(LabelTreeSchema.parse({ title: "Judul", count: "1" }), "")).not.toEqual(english);
	});
});
