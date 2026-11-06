import { describe, expect, it } from "vitest";

import { decodeKeys, openKeyboard } from "../keyboard.ts";

describe("decodeKeys", () => {
	it("reads arrows, paging and the edges", () => {
		expect(decodeKeys("\u001B[A\u001B[B\u001B[C\u001B[D")).toStrictEqual(["up", "down", "next", "previous"]);
		expect(decodeKeys("\u001B[5~\u001B[6~\u001B[H\u001B[F")).toStrictEqual(["pageUp", "pageDown", "home", "end"]);
	});

	it("reads tab both ways, enter, escape and Ctrl+C", () => {
		expect(decodeKeys("\t\u001B[Z\r\n\u001B\u0003")).toStrictEqual(["next", "previous", "enter", "enter", "escape", "interrupt"]);
	});

	it("reads the letter keys and the view numbers", () => {
		expect(decodeKeys("hjklgGq123456")).toStrictEqual(["previous", "down", "up", "next", "home", "end", "quit", "view1", "view2", "view3", "view4", "view5", "view6"]);
	});

	it("drops anything else, whole sequences included", () => {
		expect(decodeKeys("x\u001B[1;5A7")).toStrictEqual([]);
	});
});

describe("openKeyboard", () => {
	it("gives nothing, rather than failing, with no terminal to read", () => {
		// The test runner has no controlling terminal when run by a hook or CI; with one, it opens and closes cleanly.
		const keyboard = openKeyboard(() => undefined);

		expect(() => keyboard?.close()).not.toThrow();
	});
});
