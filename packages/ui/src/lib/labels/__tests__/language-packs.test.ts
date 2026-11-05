import { catalogIssues, JsonValueSchema, MessageCatalogSchema, type JsonValue, type MessageCatalog } from "@workspace/shared";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { UI_KIT_LABELS_EN } from "../en";
import { UI_KIT_LANGUAGE_PACKS } from "../all-language-packs";
import { UI_KIT_LANGUAGE_NAMES, UI_KIT_LANGUAGES, UiKitLanguageSchema } from "../language-packs";
import ENGLISH_MESSAGES from "../messages/en.json";
import MALAY_MESSAGES from "../messages/ms.json";
import TAMIL_MESSAGES from "../messages/ta.json";
import SIMPLIFIED_CHINESE_MESSAGES from "../messages/zh-Hans.json";
import type { UiKitLabels } from "../ui-kit-labels";
import { UI_KIT_FORMAT_LOCALES } from "../ui-kit-messages";

/** Each language's catalogue, read as a catalogue (the JSON files, exactly as they ship). */
const CATALOGUES: Readonly<Record<(typeof UI_KIT_LANGUAGES)[number], MessageCatalog>> = {
	en: MessageCatalogSchema.parse(ENGLISH_MESSAGES),
	ms: MessageCatalogSchema.parse(MALAY_MESSAGES),
	"zh-Hans": MessageCatalogSchema.parse(SIMPLIFIED_CHINESE_MESSAGES),
	ta: MessageCatalogSchema.parse(TAMIL_MESSAGES),
};

/** Functions in a pack become this marker when the pack is serialised, so its shape can be compared. */
const FUNCTION_MARKER = "\u0000function";

const JsonArraySchema = z.array(JsonValueSchema);
const JsonObjectSchema = z.record(z.string(), JsonValueSchema);

/** A pack as JSON: strings stay, arrays stay, every function becomes {@link FUNCTION_MARKER}. */
function serialised(pack: UiKitLabels): JsonValue {
	return JsonValueSchema.parse(
		JSON.parse(JSON.stringify(pack, (_key: string, value: JsonValue | (() => string)): JsonValue => (value instanceof Function ? FUNCTION_MARKER : value))),
	);
}

/** Every leaf of a serialised pack: its path and its text (or the function marker). */
function leavesOf(node: JsonValue, prefix = ""): readonly (readonly [string, string])[] {
	const array = JsonArraySchema.safeParse(node);
	if (array.success) {
		return [[prefix, `array(${String(array.data.length)})`]];
	}
	const object = JsonObjectSchema.safeParse(node);
	if (object.success) {
		return Object.entries(object.data).flatMap(([key, child]) => leavesOf(child, prefix === "" ? key : `${prefix}.${key}`));
	}
	// The remaining JSON values are leaves: label text (or the function marker), never null or a number here.
	const text = z.string().safeParse(node);
	return [[prefix, text.success ? text.data : JSON.stringify(node)]];
}

/** A pack's shape: each leaf's kind, keyed by its path. */
function shapeOf(pack: UiKitLabels): ReadonlyMap<string, string> {
	return new Map(
		leavesOf(serialised(pack)).map(([path, text]): [string, string] => [path, text === FUNCTION_MARKER ? "function" : text.startsWith("array(") ? text : "string"]),
	);
}

/** Every string leaf of a pack (functions and arrays left out). */
function stringsOf(pack: UiKitLabels): readonly (readonly [string, string])[] {
	return leavesOf(serialised(pack)).filter(([, text]) => text !== FUNCTION_MARKER && !text.startsWith("array("));
}

describe("the UI kit language packs (ADR 076)", () => {
	it("ships English, Malay, Simplified Chinese and Tamil, each named in itself", () => {
		expect([...UI_KIT_LANGUAGES]).toStrictEqual(["en", "ms", "zh-Hans", "ta"]);
		expect(UiKitLanguageSchema.safeParse("zh-Hans").success).toBe(true);
		expect(Object.keys(UI_KIT_LANGUAGE_NAMES)).toStrictEqual([...UI_KIT_LANGUAGES]);
	});

	it.each(UI_KIT_LANGUAGES)("%s's catalogue has exactly English's keys, and every message parses with English's placeholders", (language) => {
		expect(catalogIssues(CATALOGUES.en, CATALOGUES[language])).toStrictEqual([]);
	});

	it("formats numbers by Malaysian conventions in every language, and pluralises by each language's rules", () => {
		expect(Object.keys(UI_KIT_FORMAT_LOCALES)).toStrictEqual([...UI_KIT_LANGUAGES]);
		expect(UI_KIT_LANGUAGE_PACKS.en.cascader.itemCount(1)).toBe("1 item");
		expect(UI_KIT_LANGUAGE_PACKS.en.cascader.itemCount(1234567)).toBe("1,234,567 items");
		expect(UI_KIT_LANGUAGE_PACKS.ta.cascader.itemCount(1234567)).toBe("1,234,567 உருப்படிகள்");
		expect(UI_KIT_LANGUAGE_PACKS.ms.cascader.itemCount(1)).toBe("1 item");
	});

	it.each(UI_KIT_LANGUAGES.filter((language) => language !== "en"))("%s has exactly the English pack's shape", (language) => {
		expect(shapeOf(UI_KIT_LANGUAGE_PACKS[language])).toStrictEqual(shapeOf(UI_KIT_LABELS_EN));
	});

	it.each(UI_KIT_LANGUAGES.filter((language) => language !== "en"))("%s leaves no string empty where English has words", (language) => {
		const english = new Map(stringsOf(UI_KIT_LABELS_EN));
		const empties = stringsOf(UI_KIT_LANGUAGE_PACKS[language]).filter(([path, text]) => text.trim() === "" && (english.get(path) ?? "").trim() !== "");
		expect(empties).toStrictEqual([]);
	});

	it.each(UI_KIT_LANGUAGES.filter((language) => language !== "en"))("%s translates the words people read (most strings differ from English)", (language) => {
		const english = new Map(stringsOf(UI_KIT_LABELS_EN));
		const strings = stringsOf(UI_KIT_LANGUAGE_PACKS[language]);
		const same = strings.filter(([path, text]) => english.get(path) === text && /[a-z]{4,}/u.test(text));
		// Some words are the same in every language (PDF, CSV, Nord, date-format tokens); real copy must not be.
		expect(same.length / strings.length).toBeLessThan(0.2);
	});

	it.each(UI_KIT_LANGUAGES)("%s's functions produce text", (language) => {
		const pack = UI_KIT_LANGUAGE_PACKS[language];
		expect(pack.listPager.position(2, 5)).toContain("5");
		expect(pack.filters.relativeDate({ unit: "week", offset: -2 })).toContain("2");
		expect(pack.cascader.resultsAnnouncement(1).length).toBeGreaterThan(0);
		expect(pack.colorPicker.colorName({ kind: "chromatic", hue: "blue", shade: "dark", tone: "normal" }).length).toBeGreaterThan(0);
		expect(pack.fileUpload.formatSize(2048)).toMatch(/\d/u);
	});
});
