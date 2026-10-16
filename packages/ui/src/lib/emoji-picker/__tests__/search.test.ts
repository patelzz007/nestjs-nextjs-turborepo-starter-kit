import { describe, expect, it } from "vitest";

import type { EmojiPickerEmoji } from "./data";
import { bareEmojiValue, findEmoji, foldSearchText, getEmojiValue, isEmojiValue, isRegionalFlag, normalizeCustomEmoji, searchEmojis } from "./search";

const THUMBS_UP: EmojiPickerEmoji = {
	id: "1F44D",
	emoji: "👍",
	label: "thumbs up",
	tags: ["hand", "yes"],
	shortcodes: ["+1", "thumbsup"],
	category: "people",
	version: 0.6,
	skins: ["👍🏻", "👍🏼", "👍🏽", "👍🏾", "👍🏿"],
};
const HEART: EmojiPickerEmoji = { id: "2764-FE0F", emoji: "❤️", label: "red heart", tags: ["love"], shortcodes: ["heart"], category: "symbols", version: 0.6 };
const CAT: EmojiPickerEmoji = { id: "1F431", emoji: "🐱", label: "ネコ", tags: ["cat"], shortcodes: [], category: "nature", version: 0.6 };
const HAND_HEART: EmojiPickerEmoji = { id: "1FAF6", emoji: "🫶", label: "heart hands", tags: ["love", "hand"], shortcodes: ["heart_hands"], category: "people", version: 14 };
const ALL: readonly EmojiPickerEmoji[] = [THUMBS_UP, HEART, CAT, HAND_HEART];

describe("emoji values", () => {
	it("applies a skin tone only to emoji that take one", (): void => {
		expect(getEmojiValue(THUMBS_UP)).toBe("👍");
		expect(getEmojiValue(THUMBS_UP, 3)).toBe("👍🏽");
		expect(getEmojiValue(HEART, 3)).toBe("❤️");
	});

	it("stores a custom emoji as its first shortcode", (): void => {
		const parrot = normalizeCustomEmoji({ id: "partyparrot", label: "party parrot", src: "/parrot.gif" });
		expect(parrot.shortcodes).toStrictEqual(["partyparrot"]);
		expect(parrot.category).toBe("custom");
		expect(getEmojiValue(parrot)).toBe(":partyparrot:");
		expect(getEmojiValue(normalizeCustomEmoji({ id: "x", label: "x", src: "/x.png", shortcodes: ["ex"], category: "team" }))).toBe(":ex:");
	});

	it("matches a value in any tone and with or without VS16", (): void => {
		expect(bareEmojiValue("❤️")).toBe("❤");
		expect(isEmojiValue(HEART, "❤")).toBe(true);
		expect(isEmojiValue(THUMBS_UP, "👍🏿")).toBe(true);
		expect(isEmojiValue(THUMBS_UP, "❤")).toBe(false);
		expect(findEmoji(ALL, "👍🏼")).toBe(THUMBS_UP);
		expect(findEmoji(ALL, null)).toBeUndefined();
		expect(findEmoji(ALL, "")).toBeUndefined();
	});

	it("recognises country and subdivision flags", (): void => {
		expect(isRegionalFlag("🇪🇺")).toBe(true);
		expect(isRegionalFlag("🏴󠁧󠁢󠁳󠁣󠁴󠁿")).toBe(true);
		expect(isRegionalFlag("👍")).toBe(false);
	});
});

describe("searchEmojis", () => {
	it("folds accents and reads hiragana as katakana", (): void => {
		expect(foldSearchText("Café")).toBe("cafe");
		expect(foldSearchText("ねこ")).toBe("ネコ");
		expect(searchEmojis(ALL, "ねこ")).toStrictEqual([CAT]);
	});

	it("ranks a shortcode or name match above a keyword match", (): void => {
		expect(searchEmojis(ALL, "heart")).toStrictEqual([HEART, HAND_HEART]);
		expect(searchEmojis(ALL, "love")).toStrictEqual([HEART, HAND_HEART]);
	});

	it("needs every word to match, and ignores shortcode colons", (): void => {
		expect(searchEmojis(ALL, "heart hand")).toStrictEqual([HAND_HEART]);
		expect(searchEmojis(ALL, ":thumbsup:")).toStrictEqual([THUMBS_UP]);
		expect(searchEmojis(ALL, "zebra")).toStrictEqual([]);
		expect(searchEmojis(ALL, "   ")).toStrictEqual([]);
	});

	it("puts the emoji itself first, and honours a limit", (): void => {
		expect(searchEmojis(ALL, "👍🏽")).toStrictEqual([THUMBS_UP]);
		expect(searchEmojis(ALL, "h", { limit: 1 })).toHaveLength(1);
	});
});
