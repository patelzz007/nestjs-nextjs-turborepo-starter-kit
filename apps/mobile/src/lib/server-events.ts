// ============================================
// lib/server-events.ts - Server-Sent Events on the phone
// ============================================
// React Native has no EventSource, and its own fetch cannot stream a body;
// `expo/fetch` can. This opens one SSE stream with the session's bearer token,
// parses its frames (`event:` / `data:`, blank line between frames, `:` comments
// ignored), and keeps it open: a dropped or refused stream reconnects with
// backoff (1 s, 2 s, 4 s … at most 30 s, reset once a stream opens). A 401
// asks for a session refresh first; a refresh that fails stops the stream
// (the app then signs the person out as it does for any request). `close()`
// stops it for good.

/** One frame: its `event:` type (`message` when it named none) and its `data:` lines joined. */
export interface ServerEvent {
	readonly type: string;
	readonly data: string;
}

const DEFAULT_EVENT_TYPE = "message";
const FIELD_SEPARATOR = ":";

/** Splits a stream's text into frames; holds a partial frame until the rest arrives. */
export class ServerEventParser {
	private _buffer = "";

	/** The frames completed by `chunk`, in order. */
	public feed(chunk: string): ServerEvent[] {
		this._buffer += chunk.replace(/\r\n?/gu, "\n");
		const events: ServerEvent[] = [];
		for (let end = this._buffer.indexOf("\n\n"); end !== -1; end = this._buffer.indexOf("\n\n")) {
			const frame = this._buffer.slice(0, end);
			this._buffer = this._buffer.slice(end + 2);
			const event = parseFrame(frame);
			if (event !== null) {
				events.push(event);
			}
		}
		return events;
	}
}

function parseFrame(frame: string): ServerEvent | null {
	let type = DEFAULT_EVENT_TYPE;
	const data: string[] = [];
	for (const line of frame.split("\n")) {
		if (line.length === 0 || line.startsWith(FIELD_SEPARATOR)) {
			continue;
		}
		const separator = line.indexOf(FIELD_SEPARATOR);
		const field = separator === -1 ? line : line.slice(0, separator);
		const value = separator === -1 ? "" : line.slice(separator + 1).replace(/^ /u, "");
		if (field === "event") {
			type = value;
		} else if (field === "data") {
			data.push(value);
		}
	}
	return data.length === 0 && type === DEFAULT_EVENT_TYPE ? null : { type, data: data.join("\n") };
}

/** What the stream needs of a response — `expo/fetch`'s answers it. */
export interface StreamingResponse {
	readonly ok: boolean;
	readonly status: number;
	readonly body: ReadableStream<Uint8Array> | null;
}

export type StreamingFetch = (url: string, init: { readonly headers: Record<string, string>; readonly signal: AbortSignal }) => Promise<StreamingResponse>;

/** Where a stream stands: opening, open, waiting to reconnect, or stopped for good. */
export type ServerEventStreamState = "connecting" | "open" | "reconnecting" | "closed";

export interface ServerEventStreamOptions {
	readonly url: string;
	readonly fetch: StreamingFetch;
	readonly getAccessToken: () => Promise<string | null>;
	/** Renews the session after a 401; `false` stops the stream. */
	readonly refreshSession: () => Promise<boolean>;
	readonly onEvent: (event: ServerEvent) => void;
	readonly onState: (state: ServerEventStreamState) => void;
	/** Waits between attempts — replaced in tests. */
	readonly wait?: ((ms: number, signal: AbortSignal) => Promise<void>) | undefined;
}

export interface ServerEventStream {
	close(): void;
}

const RECONNECT_INITIAL_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
const HTTP_UNAUTHORIZED = 401;

/** The delay before reconnect attempt `attempt` (0-based). */
export function reconnectDelayMs(attempt: number): number {
	return Math.min(RECONNECT_MAX_MS, RECONNECT_INITIAL_MS * 2 ** attempt);
}

function waitFor(ms: number, signal: AbortSignal): Promise<void> {
	return new Promise((resolve): void => {
		const timer = setTimeout(resolve, ms);
		signal.addEventListener(
			"abort",
			(): void => {
				clearTimeout(timer);
				resolve();
			},
			{ once: true },
		);
	});
}

/** What one connection attempt came to. */
type AttemptOutcome = "dropped" | "refused" | "unauthorized";

async function readStream(body: ReadableStream<Uint8Array>, onEvent: (event: ServerEvent) => void, signal: AbortSignal): Promise<void> {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	const parser = new ServerEventParser();
	try {
		for (let read = await reader.read(); !read.done && !signal.aborted; read = await reader.read()) {
			for (const event of parser.feed(decoder.decode(read.value, { stream: true }))) {
				onEvent(event);
			}
		}
	} finally {
		reader.releaseLock();
	}
}

/** Opens the stream now and keeps it open until `close()`. */
export function openServerEventStream(options: ServerEventStreamOptions): ServerEventStream {
	const controller = new AbortController();
	const wait = options.wait ?? waitFor;
	/** Read afresh each time: `close()` may run while an attempt is awaited. */
	const closed = (): boolean => controller.signal.aborted;

	const attempt = async (): Promise<AttemptOutcome> => {
		const token = await options.getAccessToken();
		const headers: Record<string, string> = { Accept: "text/event-stream", ...(token === null ? {} : { Authorization: `Bearer ${token}` }) };
		const response = await options.fetch(options.url, { headers, signal: controller.signal });
		if (response.status === HTTP_UNAUTHORIZED) {
			return "unauthorized";
		}
		if (!response.ok || response.body === null) {
			return "refused";
		}
		options.onState("open");
		await readStream(response.body, options.onEvent, controller.signal);
		return "dropped";
	};

	const run = async (): Promise<void> => {
		let failures = 0;
		options.onState("connecting");
		while (!closed()) {
			let outcome: AttemptOutcome;
			try {
				outcome = await attempt();
			} catch {
				outcome = "refused";
			}
			if (closed()) {
				break;
			}
			if (outcome === "unauthorized" && !(await options.refreshSession())) {
				break;
			}
			// A stream that opened and then dropped starts the backoff again.
			failures = outcome === "dropped" ? 0 : failures + 1;
			options.onState("reconnecting");
			await wait(reconnectDelayMs(failures), controller.signal);
		}
		options.onState("closed");
	};

	void run();
	return {
		close: (): void => {
			controller.abort();
		},
	};
}
