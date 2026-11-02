// expo/fetch under Jest (jest.setup.ts mocks "expo/fetch" with this module): the streaming fetch the
// app's live streams (SSE) use. Every request opens a stream that stays open and quiet — the server
// has nothing to say yet — until the app aborts it or a test sends a frame down it (`sendToStreams`).
// A suite that drives its own stream answers (github-pull-requests.test.tsx) mocks "expo/fetch"
// itself, which replaces this one. Reset before every test.

interface FakeStream {
	readonly url: string;
	readonly headers: Readonly<Record<string, string>>;
	readonly controller: ReadableStreamDefaultController<Uint8Array>;
	closed: boolean;
}

interface FakeInit {
	readonly headers: Record<string, string>;
	readonly signal: AbortSignal;
}

interface FakeResponse {
	readonly ok: boolean;
	readonly status: number;
	readonly body: ReadableStream<Uint8Array>;
}

const HTTP_OK = 200;
const encoder = new TextEncoder();
const streams: FakeStream[] = [];

export function fetch(url: string, init: FakeInit): Promise<FakeResponse> {
	const body = new ReadableStream<Uint8Array>({
		start(controller): void {
			const stream: FakeStream = { url, headers: init.headers, controller, closed: false };
			streams.push(stream);
			init.signal.addEventListener(
				"abort",
				(): void => {
					closeStream(stream);
				},
				{ once: true },
			);
		},
	});
	return Promise.resolve({ ok: true, status: HTTP_OK, body });
}

function closeStream(stream: FakeStream): void {
	if (!stream.closed) {
		stream.closed = true;
		stream.controller.close();
	}
}

/** The streams still open, oldest first. */
export function openStreams(): readonly { readonly url: string; readonly headers: Readonly<Record<string, string>> }[] {
	return streams.filter((stream: FakeStream): boolean => !stream.closed).map((stream: FakeStream) => ({ url: stream.url, headers: stream.headers }));
}

/** Sends one SSE frame (`data: …`, a blank line after it) down every open stream whose URL contains `urlPart`. */
export function sendToStreams(urlPart: string, data: string): void {
	for (const stream of streams) {
		if (!stream.closed && stream.url.includes(urlPart)) {
			stream.controller.enqueue(encoder.encode(`data: ${data}\n\n`));
		}
	}
}

export function reset(): void {
	for (const stream of streams) {
		closeStream(stream);
	}
	streams.length = 0;
}
