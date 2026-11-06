// The keys the hooks' dashboard understands. git owns a hook's stdin (it pipes the refs into pre-push), so they are
// read from the terminal itself. No terminal to open just means no keys: the checks run the same.
import { openSync } from "node:fs";
import { ReadStream } from "node:tty";

export type KeyName =
	| "next"
	| "previous"
	| "up"
	| "down"
	| "pageUp"
	| "pageDown"
	| "home"
	| "end"
	| "enter"
	| "escape"
	| "quit"
	| "interrupt"
	| "view1"
	| "view2"
	| "view3"
	| "view4"
	| "view5"
	| "view6";

export interface Keyboard {
	close(): void;
}

/** Opens the keyboard, or gives undefined when there is none to read. */
export type KeyboardOpener = (onKey: (key: KeyName) => void) => Keyboard | undefined;

const ESCAPE = "\u001B";
const TERMINAL_DEVICE = "/dev/tty";

const KEYS = new Map<string, KeyName>([
	[`${ESCAPE}[A`, "up"],
	[`${ESCAPE}[B`, "down"],
	[`${ESCAPE}[C`, "next"],
	[`${ESCAPE}[D`, "previous"],
	[`${ESCAPE}[Z`, "previous"],
	[`${ESCAPE}[5~`, "pageUp"],
	[`${ESCAPE}[6~`, "pageDown"],
	[`${ESCAPE}[H`, "home"],
	[`${ESCAPE}[F`, "end"],
	[ESCAPE, "escape"],
	["\t", "next"],
	["\r", "enter"],
	["\n", "enter"],
	["\u0003", "interrupt"],
	["k", "up"],
	["j", "down"],
	["h", "previous"],
	["l", "next"],
	["g", "home"],
	["G", "end"],
	["q", "quit"],
	["1", "view1"],
	["2", "view2"],
	["3", "view3"],
	["4", "view4"],
	["5", "view5"],
	["6", "view6"],
]);

/** One escape sequence or one character per match, so several keys arriving together all count. */
const KEY_TOKEN = new RegExp(`${ESCAPE}\\[[0-9;]*[A-Za-z~]|[\\s\\S]`, "gu");

/** What the terminal sent, as keys. Anything else is dropped. */
export function decodeKeys(data: string): readonly KeyName[] {
	return (data.match(KEY_TOKEN) ?? []).flatMap((token) => {
		const key = KEYS.get(token);
		return key === undefined ? [] : [key];
	});
}

export const openKeyboard: KeyboardOpener = (onKey) => {
	let input: ReadStream;
	try {
		input = new ReadStream(openSync(TERMINAL_DEVICE, "r"));
		input.setRawMode(true);
	} catch {
		return undefined;
	}
	input.on("data", (data) => {
		decodeKeys(data.toString()).forEach(onKey);
	});
	return {
		close: (): void => {
			input.setRawMode(false);
			input.destroy();
		},
	};
};
