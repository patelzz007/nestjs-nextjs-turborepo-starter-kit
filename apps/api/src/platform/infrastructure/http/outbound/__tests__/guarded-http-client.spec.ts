import type { LookupAddress } from "node:dns";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { createGuardedLookup, GuardedHttpClient, OutboundAddressBlockedError, type HostResolver } from "../guarded-http-client";

const LOOPBACK_ALLOWED = { allowLoopback: true };
const STRICT = { allowLoopback: false };
const TIMEOUT_MS = 2_000;
const SHORT_TIMEOUT_MS = 100;
const MAX_RESPONSE_BYTES = 64;
const HTTP_OK = 200;
const HTTP_FOUND = 302;
/** How long the slow route waits before answering (past {@link SHORT_TIMEOUT_MS}). */
const SLOW_ANSWER_MS = 1_000;
const LARGE_BODY_BYTES = 10_000;

const ReceivedSchema = z.object({ method: z.string(), body: z.string(), signature: z.string().optional() });
type Received = z.output<typeof ReceivedSchema>;

/** A resolver that answers from a fixed table. */
function resolverOf(table: Readonly<Record<string, readonly LookupAddress[]>>): HostResolver {
	return (hostname: string): Promise<readonly LookupAddress[]> => {
		const addresses = table[hostname];
		return addresses === undefined ? Promise.reject(new Error(`getaddrinfo ENOTFOUND ${hostname}`)) : Promise.resolve(addresses);
	};
}

describe("GuardedHttpClient", () => {
	let server: Server;
	let port: number;
	const received: Received[] = [];

	beforeAll(async () => {
		server = createServer((request: IncomingMessage, response: ServerResponse): void => {
			const chunks: Buffer[] = [];
			request.on("data", (chunk: Buffer) => {
				chunks.push(chunk);
			});
			request.on("end", () => {
				const signature = request.headers["webhook-signature"];
				received.push(ReceivedSchema.parse({ method: request.method, body: Buffer.concat(chunks).toString("utf8"), signature }));
				if (request.url === "/slow") {
					setTimeout(() => response.end("late"), SLOW_ANSWER_MS);
					return;
				}
				if (request.url === "/redirect") {
					response.writeHead(HTTP_FOUND, { location: "http://169.254.169.254/latest/meta-data" }).end();
					return;
				}
				if (request.url === "/large") {
					response.writeHead(HTTP_OK).end("x".repeat(LARGE_BODY_BYTES));
					return;
				}
				response.writeHead(HTTP_OK, { "content-type": "text/plain" }).end("ok");
			});
		});
		await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
		port = z.custom<AddressInfo>((value) => z.object({ port: z.number() }).safeParse(value).success).parse(server.address()).port;
	});

	afterAll(async () => {
		await new Promise<void>((resolve) => {
			server.close(() => {
				resolve();
			});
		});
	});

	it("posts the body and headers and reports the answer", async () => {
		const client = new GuardedHttpClient(LOOPBACK_ALLOWED);
		const result = await client.post({
			url: `http://127.0.0.1:${String(port)}/hook`,
			body: '{"hello":"world"}',
			headers: { "content-type": "application/json", "webhook-signature": "t=1,v1=abc" },
			timeoutMs: TIMEOUT_MS,
			maxResponseBytes: MAX_RESPONSE_BYTES,
		});
		expect(result).toMatchObject({ kind: "answered", status: HTTP_OK, bodyExcerpt: "ok" });
		expect(received.at(-1)).toStrictEqual({ method: "POST", body: '{"hello":"world"}', signature: "t=1,v1=abc" });
	});

	it("does not follow a redirect", async () => {
		const client = new GuardedHttpClient(LOOPBACK_ALLOWED);
		const result = await client.post({
			url: `http://127.0.0.1:${String(port)}/redirect`,
			body: "{}",
			headers: {},
			timeoutMs: TIMEOUT_MS,
			maxResponseBytes: MAX_RESPONSE_BYTES,
		});
		expect(result).toMatchObject({ kind: "answered", status: HTTP_FOUND });
	});

	it("reads at most the response cap", async () => {
		const client = new GuardedHttpClient(LOOPBACK_ALLOWED);
		const result = await client.post({ url: `http://127.0.0.1:${String(port)}/large`, body: "{}", headers: {}, timeoutMs: TIMEOUT_MS, maxResponseBytes: MAX_RESPONSE_BYTES });
		expect(result.kind).toBe("answered");
		expect(result.kind === "answered" ? result.bodyExcerpt.length : -1).toBe(MAX_RESPONSE_BYTES);
	});

	it("gives up at the deadline", async () => {
		const client = new GuardedHttpClient(LOOPBACK_ALLOWED);
		const result = await client.post({
			url: `http://127.0.0.1:${String(port)}/slow`,
			body: "{}",
			headers: {},
			timeoutMs: SHORT_TIMEOUT_MS,
			maxResponseBytes: MAX_RESPONSE_BYTES,
		});
		expect(result.kind).toBe("timed_out");
	});

	it("refuses a loopback target without the development switch, before sending anything", async () => {
		const before = received.length;
		const result = await new GuardedHttpClient(STRICT).post({
			url: `http://127.0.0.1:${String(port)}/hook`,
			body: "{}",
			headers: {},
			timeoutMs: TIMEOUT_MS,
			maxResponseBytes: MAX_RESPONSE_BYTES,
		});
		expect(result).toMatchObject({ kind: "refused", reason: "scheme_not_allowed" });
		expect(received.length).toBe(before);
	});

	it("refuses a public-looking name that resolves to a private address (DNS rebinding), before connecting", async () => {
		const client = new GuardedHttpClient(STRICT, resolverOf({ "hooks.evil.example": [{ address: "10.0.0.7", family: 4 }] }));
		const result = await client.post({ url: "https://hooks.evil.example/hook", body: "{}", headers: {}, timeoutMs: TIMEOUT_MS, maxResponseBytes: MAX_RESPONSE_BYTES });
		expect(result).toMatchObject({ kind: "refused", reason: "address_not_allowed" });
	});

	it("reports a name that does not resolve as a failure", async () => {
		const client = new GuardedHttpClient(STRICT, resolverOf({}));
		const result = await client.post({ url: "https://nowhere.example/hook", body: "{}", headers: {}, timeoutMs: TIMEOUT_MS, maxResponseBytes: MAX_RESPONSE_BYTES });
		expect(result).toMatchObject({ kind: "failed", message: "getaddrinfo ENOTFOUND nowhere.example" });
	});
});

describe("createGuardedLookup", () => {
	function lookupOnce(
		table: Readonly<Record<string, readonly LookupAddress[]>>,
		all: boolean,
	): Promise<{ readonly error: Error | null; readonly address: string | LookupAddress[] }> {
		const lookup = createGuardedLookup(STRICT, resolverOf(table));
		return new Promise((resolve) => {
			lookup("hooks.example.com", { all }, (error, address) => {
				resolve({ error, address });
			});
		});
	}

	it("hands back the checked address, or all of them when asked", async () => {
		const table = {
			"hooks.example.com": [
				{ address: "93.184.216.34", family: 4 },
				{ address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 },
			],
		};
		expect(await lookupOnce(table, false)).toStrictEqual({ error: null, address: "93.184.216.34" });
		expect((await lookupOnce(table, true)).address).toStrictEqual(table["hooks.example.com"]);
	});

	it("refuses the host when ANY of its addresses is private (a mixed answer hides a rebinding)", async () => {
		const outcome = await lookupOnce(
			{
				"hooks.example.com": [
					{ address: "93.184.216.34", family: 4 },
					{ address: "127.0.0.1", family: 4 },
				],
			},
			true,
		);
		expect(outcome.error).toBeInstanceOf(OutboundAddressBlockedError);
	});

	it("fails a host with no address of the wanted family", async () => {
		const lookup = createGuardedLookup(STRICT, resolverOf({ "hooks.example.com": [{ address: "93.184.216.34", family: 4 }] }));
		const outcome = await new Promise<Error | null>((resolve) => {
			lookup("hooks.example.com", { family: 6 }, (error) => {
				resolve(error);
			});
		});
		expect(outcome?.message).toBe("hooks.example.com has no address");
	});
});
