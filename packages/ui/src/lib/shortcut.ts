// ============================================================
// lib/shortcut.ts
//
// Shared keyboard-shortcut parsing for open-and-focus "⌘K"-style
// features (used by Combobox and Select). SSR-safe by construction:
// it is pure string/event logic with no window access.
// ============================================================

import { z } from "zod";

/** A parsed shortcut: a single key plus which modifier keys must be down. */
export interface ShortcutSpec {
	readonly key: string;
	readonly meta: boolean;
	readonly ctrl: boolean;
	readonly alt: boolean;
	readonly shift: boolean;
}

/** Validates that a shortcut token is a non-empty string (rule 13). */
const SHORTCUT_TOKEN_SCHEMA = z.string().min(1);

/**
 * Parses a shortcut label into a `ShortcutSpec`, or `undefined` when the
 * label has no usable key token. Accepts both "⌘K" (symbol-prefixed) and
 * "Ctrl+K" / "⌘+Shift+K" (separated) notations. Each part may carry leading
 * modifier symbols that are stripped before treating the remainder as the key.
 */
export function parseShortcut(shortcut: string): ShortcutSpec | undefined {
	const parts = shortcut
		.split("+")
		.map((part) => part.trim())
		.filter((part) => part !== "");
	let meta = false;
	let ctrl = false;
	let alt = false;
	let shift = false;
	const keyTokens: string[] = [];
	for (const part of parts) {
		let rest = part;
		while (rest.startsWith("⌘")) {
			meta = true;
			rest = rest.slice(1);
		}
		while (rest.startsWith("⌃")) {
			ctrl = true;
			rest = rest.slice(1);
		}
		while (rest.startsWith("⌥")) {
			alt = true;
			rest = rest.slice(1);
		}
		while (rest.startsWith("⇧")) {
			shift = true;
			rest = rest.slice(1);
		}
		const lower = rest.toLowerCase();
		if (lower === "meta" || lower === "cmd") {
			meta = true;
		} else if (lower === "ctrl" || lower === "control") {
			ctrl = true;
		} else if (lower === "alt" || lower === "option") {
			alt = true;
		} else if (lower === "shift") {
			shift = true;
		} else if (rest !== "") {
			keyTokens.push(rest);
		}
	}
	const keyToken = keyTokens[keyTokens.length - 1];
	const parsedKey = SHORTCUT_TOKEN_SCHEMA.safeParse(keyToken);
	if (!parsedKey.success) {
		return undefined;
	}
	return { key: parsedKey.data.toLowerCase(), meta, ctrl, alt, shift };
}

/** True when `event` matches the parsed `spec`. */
export function matchesShortcut(event: KeyboardEvent, spec: ShortcutSpec): boolean {
	return event.key.toLowerCase() === spec.key && event.metaKey === spec.meta && event.ctrlKey === spec.ctrl && event.altKey === spec.alt && event.shiftKey === spec.shift;
}
