import { describe, expect, it } from "vitest";

import { Screen, type ProgressStream } from "../screen.ts";

function recording(): ProgressStream & { readonly chunks: string[] } {
	const chunks: string[] = [];
	return {
		chunks,
		write: (text) => {
			chunks.push(text);
			return true;
		},
	};
}

describe("Screen", () => {
	it("saves the tab title, enters the alternate screen with the cursor hidden and wrapping off, and listens for the wheel", () => {
		const stream = recording();
		new Screen(stream).open();

		expect(stream.chunks.join("")).toBe("\u001B[22;0t\u001B[?1049h\u001B[?25l\u001B[?7l\u001B[?1000h\u001B[?1006h");
	});

	it("sets the tab title, dropping anything that could end it early", () => {
		const stream = recording();
		new Screen(stream).title("42% · Checking\u0007 your\u001B push");

		expect(stream.chunks.join("")).toBe("\u001B]0;42% · Checking your push\u0007");
	});

	it("draws a frame in one write, from the top, clearing what the last one left", () => {
		const stream = recording();
		new Screen(stream).draw(["one", "two"]);

		expect(stream.chunks).toHaveLength(1);
		expect(stream.chunks.join("")).toBe("\u001B[?2026h\u001B[Hone\u001B[K\r\ntwo\u001B[K\u001B[0J\u001B[?2026l");
	});

	it("restores everything, and only once", () => {
		const stream = recording();
		const screen = new Screen(stream);

		screen.close();
		expect(stream.chunks).toHaveLength(0);

		screen.open();
		screen.close();
		screen.close();
		expect(stream.chunks.at(-1)).toBe("\u001B[?1006l\u001B[?1000l\u001B[?7h\u001B[?25h\u001B[?1049l\u001B[23;0t");
		expect(stream.chunks).toHaveLength(2);
	});
});
