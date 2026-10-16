import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	EmojibaseDataSchema,
	EmojibaseMessagesSchema,
	EmojibaseShortcodesSchema,
	emojiPickerDataKey,
	loadEmojiPickerData,
	normalizeEmojibaseData,
	readLoadedEmojiPickerData,
	resetEmojiPickerDataCache,
	shortcodePresetsOf,
} from "./data";

const RAW_DATA = [
	{ label: "grinning face", hexcode: "1F600", emoji: "😀", tags: ["face", "grin"], group: 0, order: 2, version: 1 },
	{
		label: "waving hand",
		hexcode: "1F44B",
		emoji: "👋",
		tags: "wave",
		group: 1,
		order: 1,
		version: 0.6,
		skins: [
			{ emoji: "👋🏻", tone: 1, version: 1 },
			{ emoji: "👋🏼", tone: 2, version: 1 },
			{ emoji: "👋🏽", tone: 3, version: 1 },
			{ emoji: "👋🏾", tone: 4, version: 1 },
			{ emoji: "👋🏿", tone: 5, version: 1 },
		],
	},
	{ label: "light skin tone", hexcode: "1F3FB", emoji: "🏻", group: 2, order: 3, version: 1 },
	{ label: "broken", hexcode: 42, emoji: "?", group: 0 },
	"not an emoji",
	{
		label: "people holding hands",
		hexcode: "1F9D1-200D-1F91D-200D-1F9D1",
		emoji: "🧑‍🤝‍🧑",
		group: 1,
		order: 4,
		version: 12,
		skins: [{ emoji: "🧑🏻‍🤝‍🧑🏼", tone: [1, 2], version: 12.1 }],
	},
];

/** A self-hosted emojibase-data copy (the opt-in `url`); the default is the bundled data. */
const SELF_HOSTED = "https://cdn.test/emoji";
/** emojibase ships well over a thousand emoji; anything above this proves the real data loaded. */
const MIN_BUNDLED_EMOJIS = 1000;

describe("EmojibaseDataSchema + normalizeEmojibaseData", () => {
	it("drops entries it cannot read, skips components, and sorts by order", (): void => {
		const data = normalizeEmojibaseData(EmojibaseDataSchema.parse(RAW_DATA));
		expect(data.locale).toBe("en");
		expect(data.emojis.map((emoji): string => emoji.id)).toStrictEqual(["1F44B", "1F600", "1F9D1-200D-1F91D-200D-1F9D1"]);
	});

	it("keeps a complete set of five tones, and the tones' later version", (): void => {
		const data = normalizeEmojibaseData(EmojibaseDataSchema.parse(RAW_DATA));
		const wave = data.emojis.find((emoji): boolean => emoji.id === "1F44B");
		expect(wave?.skins).toHaveLength(5);
		expect(wave?.skinVersion).toBe(1);
		expect(wave?.tags).toStrictEqual(["wave"]);
		const pair = data.emojis.find((emoji): boolean => emoji.id === "1F9D1-200D-1F91D-200D-1F9D1");
		expect(pair?.skins).toBeUndefined();
	});

	it("merges shortcode sets without duplicates and capitalizes category names", (): void => {
		const data = normalizeEmojibaseData(EmojibaseDataSchema.parse(RAW_DATA), {
			locale: "de",
			messages: EmojibaseMessagesSchema.parse({ groups: [{ key: "smileys-emotion", message: "smileys & emotionen" }, { key: "unknown", message: "x" }, "junk"] }),
			shortcodes: [EmojibaseShortcodesSchema.parse({ "1F600": "grinning" }), EmojibaseShortcodesSchema.parse({ "1F600": ["grinning", "grin"] }), undefined],
		});
		expect(data.emojis.find((emoji): boolean => emoji.id === "1F600")?.shortcodes).toStrictEqual(["grinning", "grin"]);
		expect(data.categories).toStrictEqual({ smileys: "Smileys & emotionen" });
	});

	it("reads malformed messages and shortcode files as empty", (): void => {
		expect(EmojibaseMessagesSchema.parse("nope")).toStrictEqual({ groups: [] });
		expect(EmojibaseShortcodesSchema.parse(7)).toStrictEqual({});
	});
});

describe("shortcodePresetsOf / emojiPickerDataKey", () => {
	it("defaults to github, accepts one or many, and false for none", (): void => {
		expect(shortcodePresetsOf(undefined)).toStrictEqual(["github"]);
		expect(shortcodePresetsOf("cldr")).toStrictEqual(["cldr"]);
		expect(shortcodePresetsOf(["github", "iamcal"])).toStrictEqual(["github", "iamcal"]);
		expect(shortcodePresetsOf(false)).toStrictEqual([]);
	});

	it("keys a load by URL, locale and shortcode set", (): void => {
		expect(emojiPickerDataKey({})).toBe("bundled|en|github");
		expect(emojiPickerDataKey({ url: "/emoji", locale: "de", shortcodes: false })).toBe("/emoji|de|");
	});
});

function jsonResponse(body: object | readonly object[], ok = true): Response {
	return new Response(JSON.stringify(body), { status: ok ? 200 : 404 });
}

describe("loadEmojiPickerData", () => {
	const fetchMock = vi.fn<(input: string) => Promise<Response>>();

	beforeEach((): void => {
		resetEmojiPickerDataCache();
		fetchMock.mockReset();
		vi.stubGlobal("fetch", fetchMock);
	});

	afterEach((): void => {
		vi.unstubAllGlobals();
	});

	it("fetches data, messages and shortcodes once, then serves the cache", async (): Promise<void> => {
		fetchMock.mockImplementation((input: string): Promise<Response> => {
			if (input.endsWith("/data.json")) {
				return Promise.resolve(jsonResponse(RAW_DATA));
			}
			if (input.endsWith("/messages.json")) {
				return Promise.resolve(jsonResponse({}, false));
			}
			return Promise.resolve(jsonResponse({ "1F600": "grinning" }));
		});
		const first = await loadEmojiPickerData({ url: "https://cdn.test/emoji/" });
		const second = await loadEmojiPickerData({ url: "https://cdn.test/emoji/" });
		expect(second).toBe(first);
		expect(fetchMock.mock.calls.map(([input]): string => input)).toStrictEqual([
			"https://cdn.test/emoji/en/data.json",
			"https://cdn.test/emoji/en/messages.json",
			"https://cdn.test/emoji/en/shortcodes/github.json",
		]);
		expect(first.emojis.find((emoji): boolean => emoji.id === "1F600")?.shortcodes).toStrictEqual(["grinning"]);
		expect(readLoadedEmojiPickerData({ url: "https://cdn.test/emoji/" })).toBe(first);
	});

	it("loads English-only shortcode sets from en for another locale", async (): Promise<void> => {
		fetchMock.mockResolvedValue(jsonResponse([]));
		await loadEmojiPickerData({ url: SELF_HOSTED, locale: "ja", shortcodes: ["iamcal", "cldr"] });
		const urls = fetchMock.mock.calls.map(([input]): string => input);
		expect(urls).toContain(`${SELF_HOSTED}/en/shortcodes/iamcal.json`);
		expect(urls).toContain(`${SELF_HOSTED}/ja/shortcodes/cldr.json`);
	});

	it("rejects an invalid locale without a request, and forgets a failed load", async (): Promise<void> => {
		await expect(loadEmojiPickerData({ url: SELF_HOSTED, locale: "../evil" })).rejects.toThrow("Invalid emoji locale");
		expect(fetchMock).not.toHaveBeenCalled();

		fetchMock.mockResolvedValueOnce(jsonResponse({}, false));
		await expect(loadEmojiPickerData({ url: SELF_HOSTED, shortcodes: false })).rejects.toThrow("404");
		fetchMock.mockResolvedValue(jsonResponse(RAW_DATA));
		const data = await loadEmojiPickerData({ url: SELF_HOSTED, shortcodes: false });
		expect(data.emojis).toHaveLength(3);
	});

	it("loads the data bundled with the app by default, without any network request", async (): Promise<void> => {
		const data = await loadEmojiPickerData({});
		expect(fetchMock).not.toHaveBeenCalled();
		expect(data.emojis.length).toBeGreaterThan(MIN_BUNDLED_EMOJIS);
		expect(data.emojis.some((emoji): boolean => emoji.shortcodes.includes("thumbsup"))).toBe(true);
	});

	it("rejects a locale emojibase-data does not ship, and degrades a missing shortcode set", async (): Promise<void> => {
		await expect(loadEmojiPickerData({ locale: "xx" })).rejects.toThrow("No bundled emoji data");
		// German has no emojibase shortcode set: the emoji still load, without those codes.
		const german = await loadEmojiPickerData({ locale: "de", shortcodes: "emojibase" });
		expect(german.emojis.length).toBeGreaterThan(MIN_BUNDLED_EMOJIS);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
