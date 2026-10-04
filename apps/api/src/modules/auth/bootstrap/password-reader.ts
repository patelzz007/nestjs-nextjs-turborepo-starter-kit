import { createInterface, type Interface } from "node:readline";
import { Writable, type Readable } from "node:stream";

import type { PasswordSource } from "./superadmin-bootstrap.args";
import { BOOTSTRAP_FLAGS } from "./superadmin-bootstrap.constants";
import { BootstrapUsageError } from "./superadmin-bootstrap.errors";

/** A readable stream that may be a terminal (`process.stdin`). */
export type InputStream = Readable & { readonly isTTY?: boolean };

/** Where the secret is read from. Implementations never log, echo or return anything but the secret itself. */
export interface PasswordReader {
	read(): Promise<string>;
}

const TRAILING_NEWLINE = /\r?\n$/;
const PASSWORD_PROMPT = "Password: ";
const CONFIRMATION_PROMPT = "Confirm password: ";

/** Reads the whole of stdin (a pipe or file from a secret manager) and drops one trailing newline. */
export class StdinPasswordReader implements PasswordReader {
	public constructor(private readonly input: InputStream) {}

	public async read(): Promise<string> {
		const chunks: Buffer[] = [];
		for await (const chunk of this.input) {
			chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
		}
		return Buffer.concat(chunks).toString("utf8").replace(TRAILING_NEWLINE, "");
	}
}

/** A sink that swallows every byte: readline echoes typed characters to its `output`, so the secret never reaches the screen. */
function createMutedOutput(): Writable {
	return new Writable({
		write(_chunk: Buffer, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
			callback();
		},
	});
}

/** Interactive prompt with no echo: asks twice and requires both entries to match. */
export class TerminalPasswordReader implements PasswordReader {
	public constructor(
		private readonly input: InputStream,
		/** Where the prompt text goes (stderr, so stdout stays clean for scripts). */
		private readonly promptOutput: Writable,
	) {}

	public async read(): Promise<string> {
		const lines: LineQueue = new LineQueue(createInterface({ input: this.input, output: createMutedOutput(), terminal: true }));
		try {
			this.promptOutput.write(PASSWORD_PROMPT);
			const password: string = await lines.next();
			this.promptOutput.write("\n");
			this.promptOutput.write(CONFIRMATION_PROMPT);
			const confirmation: string = await lines.next();
			this.promptOutput.write("\n");
			if (password !== confirmation) {
				throw new BootstrapUsageError("The two passwords do not match.");
			}
			return password;
		} finally {
			lines.close();
		}
	}
}

/** Lines typed so far, delivered in order even if the user (or a paste) types ahead of the prompt. */
class LineQueue {
	private readonly buffered: string[] = [];
	private readonly waiting: { readonly resolve: (line: string) => void; readonly reject: (error: Error) => void }[] = [];
	private closedReason: Error | null = null;

	public constructor(private readonly readline: Interface) {
		readline.on("line", (line: string): void => {
			const waiter = this.waiting.shift();
			if (waiter === undefined) {
				this.buffered.push(line);
			} else {
				waiter.resolve(line);
			}
		});
		readline.on("SIGINT", (): void => {
			this.fail(new BootstrapUsageError("Aborted."));
		});
		readline.on("close", (): void => {
			this.fail(new BootstrapUsageError("Input ended before a password was entered."));
		});
	}

	public async next(): Promise<string> {
		const line: string | undefined = this.buffered.shift();
		if (line !== undefined) {
			return line;
		}
		if (this.closedReason !== null) {
			throw this.closedReason;
		}
		return new Promise<string>((resolve: (line: string) => void, reject: (error: Error) => void): void => {
			this.waiting.push({ resolve, reject });
		});
	}

	public close(): void {
		this.readline.close();
	}

	private fail(reason: Error): void {
		this.closedReason ??= reason;
		for (const waiter of this.waiting.splice(0)) {
			waiter.reject(reason);
		}
		this.readline.close();
	}
}

/** Streams the command reads and writes (injected so tests never touch the real terminal). */
export interface BootstrapStreams {
	readonly stdin: InputStream;
	readonly stderr: Writable;
}

/** Pick the reader for `source`. The interactive prompt needs a real terminal (no-echo is impossible otherwise). */
export function createPasswordReader(source: PasswordSource, streams: BootstrapStreams): PasswordReader {
	if (source === "stdin") {
		return new StdinPasswordReader(streams.stdin);
	}
	if (streams.stdin.isTTY !== true) {
		throw new BootstrapUsageError(`No terminal is attached, so the no-echo prompt is unavailable. Pipe the password in with ${BOOTSTRAP_FLAGS.passwordStdin}.`);
	}
	return new TerminalPasswordReader(streams.stdin, streams.stderr);
}
