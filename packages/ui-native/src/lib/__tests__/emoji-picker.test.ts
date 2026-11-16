import {
	completeShortcode,
	emojiPickerDataFromEmojibase,
	findEmoji,
	foldSearchText,
	getEmojiValue,
	normalizeCustomEmoji,
	openShortcodeOf,
	replaceShortcodes,
	searchEmojis,
} from "../emoji-picker";

const COMPACT = [
	{ group: 0, hexcode: "1F600", label: "grinning face", order: 1, tags: ["face", "grin"], unicode: "😀" },
	{
		group: 1,
		hexcode: "1F44D",
		label: "thumbs up",
		order: 3,
		tags: ["+1", "hand"],
		unicode: "👍️",
		skins: ["1F3FB", "1F3FC", "1F3FD", "1F3FE", "1F3FF"].map((tone: string, index: number) => ({ hexcode: `1F44D-${tone}`, unicode: `👍${String(index)}` })),
	},
	{ group: 2, hexcode: "1F3FB", label: "light skin tone", order: 2, unicode: "🏻" },
	{ hexcode: "1F1E6", label: "regional indicator A", unicode: "🇦" },
	{ group: 3, hexcode: "1F431", label: "cat face", order: 4, tags: ["cat", "pet"], unicode: "🐱" },
	"not an emoji",
];
const MESSAGES = {
	groups: [
		{ key: "smileys-emotion", message: "smileys & emotion" },
		{ key: "unknown", message: "?" },
	],
};
const SHORTCODES = [{ "1F44D": ["+1", "thumbsup"], "1F600": "grinning" }, { "1F44D": ["thumbsup", "like"] }];

const DATA = emojiPickerDataFromEmojibase({ locale: "en", compact: COMPACT, messages: MESSAGES, shortcodes: SHORTCODES });

describe("emojiPickerDataFromEmojibase", () => {
	it("keeps the emoji of the nine categories in order, with merged shortcodes and complete tone sets", () => {
		expect(DATA.emojis.map((emoji) => emoji.id)).toStrictEqual(["1F600", "1F44D", "1F431"]);
		const thumbs = DATA.emojis.find((emoji) => emoji.id === "1F44D");
		expect(thumbs?.shortcodes).toStrictEqual(["+1", "thumbsup", "like"]);
		expect(thumbs?.skins).toHaveLength(5);
		expect(DATA.emojis.find((emoji) => emoji.id === "1F600")?.skins).toBeUndefined();
		expect(DATA.categories).toStrictEqual({ smileys: "Smileys & emotion" });
	});
});

describe("values", () => {
	it("applies a skin tone, writes a custom emoji as its shortcode, and finds either back", () => {
		const thumbs = findEmoji(DATA.emojis, "👍");
		expect(thumbs?.id).toBe("1F44D");
		expect(thumbs === undefined ? "" : getEmojiValue(thumbs, 3)).toBe("👍2");
		expect(findEmoji(DATA.emojis, "👍4")?.id).toBe("1F44D");
		const parrot = normalizeCustomEmoji({ id: "parrot", label: "party parrot", src: "https://example.com/parrot.gif" });
		expect(getEmojiValue(parrot)).toBe(":parrot:");
		expect(findEmoji([parrot], ":parrot:")?.id).toBe("parrot");
		expect(findEmoji(DATA.emojis, "")).toBeUndefined();
	});
});

describe("searchEmojis", () => {
	it("ranks names and shortcodes above keywords, ignores colons and accents, and needs every word", () => {
		expect(searchEmojis(DATA.emojis, ":thumbsup:").map((emoji) => emoji.id)).toStrictEqual(["1F44D"]);
		expect(searchEmojis(DATA.emojis, "cat").map((emoji) => emoji.id)).toStrictEqual(["1F431"]);
		expect(searchEmojis(DATA.emojis, "face cat").map((emoji) => emoji.id)).toStrictEqual(["1F431"]);
		expect(searchEmojis(DATA.emojis, "  ")).toStrictEqual([]);
		expect(searchEmojis(DATA.emojis, "a", { limit: 1 })).toHaveLength(1);
		expect(foldSearchText("Café ねこ")).toBe("cafe ネコ");
	});
});

describe("shortcodes in text", () => {
	it("finds the code being typed, completes it, and swaps closed codes it knows", () => {
		expect(openShortcodeOf("nice :thu")).toBe("thu");
		expect(openShortcodeOf("time 10:3")).toBeNull();
		expect(completeShortcode("nice :thu", "👍")).toBe("nice 👍");
		expect(completeShortcode("nice", "👍")).toBe("nice");
		expect(replaceShortcodes("ship it :thumbsup: :nope:", DATA.emojis)).toBe("ship it 👍️ :nope:");
	});
});
