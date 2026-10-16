import {
	openServerEventStream,
	reconnectDelayMs,
	ServerEventParser,
	type ServerEvent,
	type ServerEventStreamState,
	type StreamingFetch,
	type StreamingResponse,
} from "../server-events";

function streamOf(chunks: readonly string[]): ReadableStream<Uint8Array> {
	const encoder = new TextEncoder();
	return new ReadableStream<Uint8Array>({
		start(controller): void {
			for (const chunk of chunks) {
				controller.enqueue(encoder.encode(chunk));
			}
			controller.close();
		},
	});
}

function answer(status: number, chunks: readonly string[] = []): StreamingResponse {
	return { ok: status >= 200 && status < 300, status, body: status >= 200 && status < 300 ? streamOf(chunks) : null };
}

describe("ServerEventParser", () => {
	it("reads frames across chunks, with their type and every data line", () => {
		const parser = new ServerEventParser();

		expect(parser.feed('data: {"number":4')).toEqual([]);
		expect(parser.feed("2}\n\nevent: resync\ndata:\n\n: a comment\n\nevent: ping\r\ndata: \r\n\r\ndata: a\ndata: b\n\n")).toEqual([
			{ type: "message", data: '{"number":42}' },
			{ type: "resync", data: "" },
			{ type: "ping", data: "" },
			{ type: "message", data: "a\nb" },
		]);
	});
});

describe("openServerEventStream", () => {
	it("sends the bearer token, hands each frame over, and reconnects when the stream ends", async () => {
		const events: ServerEvent[] = [];
		const states: ServerEventStreamState[] = [];
		const fetch = jest.fn<ReturnType<StreamingFetch>, Parameters<StreamingFetch>>().mockResolvedValueOnce(answer(200, ['data: {"number":42}\n\n', "event: ping\ndata:\n\n"]));
		const waits: number[] = [];
		let stream: ReturnType<typeof openServerEventStream> | null = null;
		stream = openServerEventStream({
			url: "https://api.example.com/events",
			fetch,
			getAccessToken: (): Promise<string> => Promise.resolve("access-1"),
			refreshSession: (): Promise<boolean> => Promise.resolve(true),
			onEvent: (event: ServerEvent): void => {
				events.push(event);
			},
			onState: (state: ServerEventStreamState): void => {
				states.push(state);
			},
			wait: (ms: number): Promise<void> => {
				waits.push(ms);
				stream?.close();
				return Promise.resolve();
			},
		});

		await waitForState(states, "closed");

		expect(fetch).toHaveBeenCalledWith(
			"https://api.example.com/events",
			expect.objectContaining({ headers: { Accept: "text/event-stream", Authorization: "Bearer access-1" } }),
		);
		expect(events).toEqual([
			{ type: "message", data: '{"number":42}' },
			{ type: "ping", data: "" },
		]);
		expect(states).toEqual(["connecting", "open", "reconnecting", "closed"]);
		expect(waits).toEqual([reconnectDelayMs(0)]);
	});

	it("renews the session after a 401 and tries again; stops when the session cannot be renewed", async () => {
		const states: ServerEventStreamState[] = [];
		const refreshSession = jest.fn<Promise<boolean>, []>().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
		const fetch = jest.fn<ReturnType<StreamingFetch>, Parameters<StreamingFetch>>().mockResolvedValue(answer(401));

		openServerEventStream({
			url: "https://api.example.com/events",
			fetch,
			getAccessToken: (): Promise<string> => Promise.resolve("expired"),
			refreshSession,
			onEvent: (): void => undefined,
			onState: (state: ServerEventStreamState): void => {
				states.push(state);
			},
			wait: (): Promise<void> => Promise.resolve(),
		});

		await waitForState(states, "closed");
		expect(fetch).toHaveBeenCalledTimes(2);
		expect(refreshSession).toHaveBeenCalledTimes(2);
	});

	it("backs off longer after each refused attempt, at most 30 s", () => {
		expect([0, 1, 2, 5, 10].map(reconnectDelayMs)).toEqual([1_000, 2_000, 4_000, 30_000, 30_000]);
	});
});

async function waitForState(states: readonly ServerEventStreamState[], state: ServerEventStreamState): Promise<void> {
	for (let tick = 0; tick < 100 && !states.includes(state); tick += 1) {
		await new Promise<void>((resolve): void => {
			setTimeout(resolve, 0);
		});
	}
	expect(states).toContain(state);
}
