import { hasGlobalValue } from "@workspace/shared";

import type { EmojiPickerEmoji } from "./data";
import { isRegionalFlag } from "./search";

/* Apple first, then Firefox's bundled Twemoji (it has flags on Windows, where
   Segoe UI Emoji does not), then Windows and Android. */
const EMOJI_FONT = '"Apple Color Emoji", "Twemoji Mozilla", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji", sans-serif';

/** What this device draws: the newest Emoji version, and whether flags render as flags. */
export interface EmojiSupport {
	readonly version: number;
	readonly flags: boolean;
}

export const FULL_EMOJI_SUPPORT: EmojiSupport = { version: Number.POSITIVE_INFINITY, flags: true };

const supportCache = new WeakMap<readonly EmojiPickerEmoji[], EmojiSupport>();

/** Glyph size (px) of the canvas probe. */
const PROBE_PX = 20;
/** The probe canvas is twice the glyph, so a wide (unjoined) sequence still lands on it. */
const PROBE_CANVAS_PX = PROBE_PX * 2;
/** A joined emoji is about one glyph wide; several glyphs side by side are wider than this. */
const MAX_SINGLE_GLYPH_WIDTH_RATIO = 1.6;
/** RGBA: four bytes per pixel. */
const BYTES_PER_PIXEL = 4;
const RED_OFFSET = 0;
const BLUE_OFFSET = 2;
const ALPHA_OFFSET = 3;
/** 🇪🇺: a flag every flag-capable font has. */
const FLAG_PROBE = "\u{1F1EA}\u{1F1FA}";

function drawProbe(context: CanvasRenderingContext2D, text: string, color: string): Uint8ClampedArray {
	context.clearRect(0, 0, PROBE_CANVAS_PX, PROBE_CANVAS_PX);
	context.fillStyle = color;
	context.fillText(text, 0, 0);
	return context.getImageData(0, 0, PROBE_CANVAS_PX, PROBE_PX).data;
}

/* A color glyph ignores fillStyle, so red and blue draws match pixel for pixel;
   a missing glyph's box takes the color. A ZWJ sequence the font cannot join
   draws as several glyphs, wider than one. */
function drawsAsEmoji(context: CanvasRenderingContext2D, text: string): boolean {
	const red = drawProbe(context, text, "red");
	const blue = drawProbe(context, text, "blue");
	let hasInk = false;
	for (let pixel = 0; pixel < red.length; pixel += BYTES_PER_PIXEL) {
		if ((red[pixel + ALPHA_OFFSET] ?? 0) === 0 && (blue[pixel + ALPHA_OFFSET] ?? 0) === 0) {
			continue;
		}
		hasInk = true;
		if (red[pixel + RED_OFFSET] !== blue[pixel + RED_OFFSET] || red[pixel + BLUE_OFFSET] !== blue[pixel + BLUE_OFFSET]) {
			return false;
		}
	}
	return hasInk && context.measureText(text).width < PROBE_PX * MAX_SINGLE_GLYPH_WIDTH_RATIO;
}

function probeContext(): CanvasRenderingContext2D | null {
	if (!hasGlobalValue("document")) {
		return null;
	}
	const canvas = document.createElement("canvas");
	canvas.width = PROBE_CANVAS_PX;
	canvas.height = PROBE_CANVAS_PX;
	try {
		return canvas.getContext("2d", { willReadFrequently: true });
	} catch {
		return null;
	}
}

/**
 * The newest Emoji version this device draws, probed with the first emoji of
 * each version in the data, newest first, plus a flag. A probe that fails even
 * the oldest version is unreliable (blocked or noised canvas), so it reports
 * full support rather than an empty grid.
 */
export function detectEmojiSupport(emojis: readonly EmojiPickerEmoji[]): EmojiSupport {
	const cached = supportCache.get(emojis);
	if (cached !== undefined) {
		return cached;
	}
	let support = FULL_EMOJI_SUPPORT;
	const context = probeContext();
	if (context !== null) {
		context.font = `${String(PROBE_PX)}px ${EMOJI_FONT}`;
		context.textBaseline = "top";
		const samples = new Map<number, string>();
		for (const emoji of emojis) {
			if (emoji.src !== undefined || isRegionalFlag(emoji.emoji) || samples.has(emoji.version)) {
				continue;
			}
			samples.set(emoji.version, emoji.emoji);
		}
		const versions = [...samples.entries()].sort(([left], [right]): number => right - left);
		const [newest] = versions;
		const found = versions.find(([, sample]): boolean => drawsAsEmoji(context, sample));
		if (found !== undefined && newest !== undefined) {
			const [foundVersion] = found;
			const [newestVersion] = newest;
			support = {
				version: foundVersion === newestVersion ? Number.POSITIVE_INFINITY : foundVersion,
				flags: drawsAsEmoji(context, FLAG_PROBE),
			};
		}
	}
	supportCache.set(emojis, support);
	return support;
}
