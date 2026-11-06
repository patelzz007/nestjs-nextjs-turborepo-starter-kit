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
	it("enters the alternate screen with the cursor hidden and wrapping off", () => {
		const stream = recording();
		new Screen(stream).open();

		expect(stream.chunks.join("")).toBe("\u001B[?1049h\u001B[?25l\u001B[?7l");
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
		expect(stream.chunks.at(-1)).toBe("\u001B[?7h\u001B[?25h\u001B[?1049l");
		expect(stream.chunks).toHaveLength(2);
	});
});
