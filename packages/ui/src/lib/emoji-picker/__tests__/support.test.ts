import { afterEach, describe, expect, it, vi } from "vitest";

import type { EmojiPickerEmoji } from "../data";
import { detectEmojiSupport, FULL_EMOJI_SUPPORT } from "../support";

const EMOJIS: readonly EmojiPickerEmoji[] = [{ id: "1F600", emoji: "😀", label: "grinning face", tags: [], shortcodes: [], category: "smileys", version: 1 }];

afterEach((): void => {
	vi.restoreAllMocks();
});

describe("detectEmojiSupport", () => {
	it("reports full support when the canvas cannot be read", (): void => {
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
		expect(detectEmojiSupport(EMOJIS)).toBe(FULL_EMOJI_SUPPORT);
	});

	it("caches the result per data set", (): void => {
		const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
		const emojis: readonly EmojiPickerEmoji[] = [...EMOJIS];
		detectEmojiSupport(emojis);
		detectEmojiSupport(emojis);
		expect(getContext).toHaveBeenCalledTimes(1);
	});
});
