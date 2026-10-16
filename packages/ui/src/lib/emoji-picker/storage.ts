import { z } from "zod";

import { EmojiPickerSkinToneSchema, type EmojiPickerRecentEntry, type EmojiPickerSkinTone } from "./data";

/** localStorage key of the recent list when the caller names none. */
export const EMOJI_PICKER_RECENT_STORAGE_KEY = "emoji-picker-recent";

/** localStorage key of the skin tone when the caller names none. */
export const EMOJI_PICKER_SKIN_TONE_STORAGE_KEY = "emoji-picker-skin-tone";

const listeners = new Map<string, Set<() => void>>();
/* Writes storage refused (private mode, quota, a blocked origin), kept for this
   page so the picker still remembers within the visit. */
const memory = new Map<string, string>();

/** One stored string, or `null`. Never throws. */
export function readStoredValue(key: string): string | null {
	const remembered = memory.get(key);
	if (remembered !== undefined) {
		return remembered;
	}
	try {
		return window.localStorage.getItem(key);
	} catch {
		return null;
	}
}

/** Stores a string (in memory when storage refuses) and tells every subscriber. */
export function writeStoredValue(key: string, value: string): void {
	try {
		window.localStorage.setItem(key, value);
		memory.delete(key);
	} catch {
		memory.set(key, value);
	}
	for (const listener of listeners.get(key) ?? []) {
		listener();
	}
}

/** Subscribes to one key: this page's writes and another tab's. */
export function subscribeStoredValue(key: string, listener: () => void): () => void {
	const keyListeners = listeners.get(key) ?? new Set<() => void>();
	listeners.set(key, keyListeners);
	keyListeners.add(listener);
	/* Another tab's write: drop this tab's copy and re-read. */
	const onStorage = (event: StorageEvent): void => {
		if (event.key !== key && event.key !== null) {
			return;
		}
		memory.delete(key);
		listener();
	};
	window.addEventListener("storage", onStorage);
	return (): void => {
		keyListeners.delete(listener);
		window.removeEventListener("storage", onStorage);
	};
}

const StoredRecentSchema = z.array(
	z
		.object({
			id: z.string(),
			count: z.number().catch(1),
		})
		.nullable()
		.catch(null),
);

function parseJsonList(raw: string): z.output<typeof StoredRecentSchema> | null {
	try {
		const parsed = StoredRecentSchema.safeParse(JSON.parse(raw));
		return parsed.success ? parsed.data : null;
	} catch {
		return null;
	}
}

/** The stored recent list, or `null` when there is none or it cannot be read. Unreadable entries drop. */
export function parseStoredRecent(raw: string | null): EmojiPickerRecentEntry[] | null {
	if (raw === null || raw === "") {
		return null;
	}
	const list = parseJsonList(raw);
	if (list === null) {
		return null;
	}
	return list.flatMap((entry: { id: string; count: number } | null): EmojiPickerRecentEntry[] => (entry === null ? [] : [{ id: entry.id, count: Math.max(1, entry.count) }]));
}

const StoredToneSchema = z.string().trim().min(1).transform(Number).pipe(EmojiPickerSkinToneSchema);

/** The stored skin tone, or `null` when there is none or it is not 0–5. */
export function parseStoredTone(raw: string | null): EmojiPickerSkinTone | null {
	if (raw === null) {
		return null;
	}
	const parsed = StoredToneSchema.safeParse(raw);
	return parsed.success ? parsed.data : null;
}
