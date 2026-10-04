import { PassThrough, Readable, Writable } from "node:stream";

import { describe, expect, it } from "vitest";

import { createPasswordReader, StdinPasswordReader, TerminalPasswordReader, type InputStream } from "./password-reader";
import { BootstrapUsageError } from "./superadmin-bootstrap.errors";

const SECRET = "Corr3ct-Horse-Battery!";

/** A terminal-like input: a stream flagged as a TTY. */
function terminalInput(): { readonly input: PassThrough & { isTTY: boolean }; readonly type: (text: string) => void } {
	const input = Object.assign(new PassThrough(), { isTTY: true });
	return { input, type: (text: string): boolean => input.write(text) };
}

/** Collects everything written to it. */
function capture(): { readonly stream: Writable; readonly text: () => string } {
	const chunks: string[] = [];
	const stream = new Writable({
		write(chunk: Buffer, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
			chunks.push(chunk.toString("utf8"));
			callback();
		},
	});
	return { stream, text: (): string => chunks.join("") };
}

describe("StdinPasswordReader", () => {
	it("returns the piped value without one trailing newline", async () => {
		expect(await new StdinPasswordReader(Readable.from([`${SECRET}\n`])).read()).toBe(SECRET);
		expect(await new StdinPasswordReader(Readable.from([`${SECRET}\r\n`])).read()).toBe(SECRET);
	});

	it("keeps internal whitespace and a value delivered in several chunks", async () => {
		expect(await new StdinPasswordReader(Readable.from(["pass ", "phrase 1!\n"])).read()).toBe("pass phrase 1!");
	});

	it("returns an empty string for empty input, so the password policy rejects it", async () => {
		expect(await new StdinPasswordReader(Readable.from([])).read()).toBe("");
	});
});

describe("TerminalPasswordReader", () => {
	it("returns the typed password and never writes it (or the confirmation) to the screen", async () => {
		const { input, type } = terminalInput();
		const screen = capture();
		const reading = new TerminalPasswordReader(input, screen.stream).read();

		type(`${SECRET}\n`);
		type(`${SECRET}\n`);

		expect(await reading).toBe(SECRET);
		expect(screen.text()).toContain("Password:");
		expect(screen.text()).toContain("Confirm password:");
		expect(screen.text()).not.toContain(SECRET);
	});

	it("accepts both lines typed ahead of the second prompt", async () => {
		const { input, type } = terminalInput();

		type(`${SECRET}\n${SECRET}\n`);

		expect(await new TerminalPasswordReader(input, capture().stream).read()).toBe(SECRET);
	});

	it("rejects when the confirmation differs", async () => {
		const { input, type } = terminalInput();
		const reading = new TerminalPasswordReader(input, capture().stream).read();

		type(`${SECRET}\n`);
		type("Something-else-1!\n");

		await expect(reading).rejects.toThrow(/do not match/);
	});

	it("rejects when input ends before a password was entered", async () => {
		const { input } = terminalInput();
		const reading = new TerminalPasswordReader(input, capture().stream).read();

		input.end();

		await expect(reading).rejects.toBeInstanceOf(BootstrapUsageError);
	});
});

describe("createPasswordReader", () => {
	const stderr = capture().stream;

	it("uses stdin for the stdin source, terminal or not", () => {
		const piped: InputStream = Readable.from([]);

		expect(createPasswordReader("stdin", { stdin: piped, stderr })).toBeInstanceOf(StdinPasswordReader);
	});

	it("uses the no-echo prompt on a terminal", () => {
		expect(createPasswordReader("prompt", { stdin: terminalInput().input, stderr })).toBeInstanceOf(TerminalPasswordReader);
	});

	it("refuses the prompt without a terminal and points at --password-stdin", () => {
		expect(() => createPasswordReader("prompt", { stdin: Readable.from([]), stderr })).toThrow(/--password-stdin/);
	});
});
