import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { PRERENDER_REQUEST_HEADERS } from "../prerender";

const AddressSchema = z.object({ port: z.number().int().positive() });

/** A local server that answers every request with the client port it arrived on (one port = one connection). */
async function portEchoServer(): Promise<{ readonly server: Server; readonly url: string; readonly connectionHeaders: (string | undefined)[] }> {
	const connectionHeaders: (string | undefined)[] = [];
	const server: Server = createServer((request: IncomingMessage, response): void => {
		connectionHeaders.push(request.headers.connection);
		response.end(String(request.socket.remotePort));
	});
	await new Promise<void>((resolve): void => {
		server.listen(0, "127.0.0.1", resolve);
	});
	const address: AddressInfo | string | null = server.address();
	const { port } = AddressSchema.parse(address);
	return { server, url: `http://127.0.0.1:${String(port)}/`, connectionHeaders };
}

/**
 * Fetches the way TanStack Start's pre-render handler does (`fetch(new Request(url, { headers, redirect }))`), then
 * lets the event loop turn once so a kept-alive connection is back in the client's pool before the next request.
 */
async function clientPort(url: string, headers?: Readonly<Record<string, string>>): Promise<string> {
	const response = await fetch(new Request(url, { headers: { ...headers }, redirect: "manual" }));
	const port = await response.text();
	await new Promise<void>((resolve): void => {
		setImmediate(resolve);
	});
	return port;
}

let open: Server | undefined;

afterEach((): void => {
	open?.closeAllConnections();
	open?.close();
	open = undefined;
});

describe("PRERENDER_REQUEST_HEADERS", () => {
	it("asks the server to close the connection after each page", () => {
		expect(PRERENDER_REQUEST_HEADERS).toEqual({ connection: "close" });
	});

	it("sends each request on a connection of its own, so none is left idle for the server to time out", async () => {
		const { server, url, connectionHeaders } = await portEchoServer();
		open = server;

		const first = await clientPort(url, PRERENDER_REQUEST_HEADERS);
		const second = await clientPort(url, PRERENDER_REQUEST_HEADERS);
		const third = await clientPort(url, PRERENDER_REQUEST_HEADERS);

		expect(new Set([first, second, third]).size).toBe(3);
		expect(connectionHeaders).toEqual(["close", "close", "close"]);
	});

	it("is what stops reuse: without it, back-to-back requests share one idle connection", async () => {
		const { server, url } = await portEchoServer();
		open = server;

		const first = await clientPort(url);
		const second = await clientPort(url);

		expect(second).toBe(first);
	});
});
