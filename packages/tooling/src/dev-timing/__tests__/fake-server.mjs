/**
 * A real HTTP server on an ephemeral loopback port, answering with whatever
 * the test's handler decides — the stand-in for a dev server in the probe
 * tests (plan §19.1: no test spawns the real stack).
 */
import http from "node:http";

import { z } from "zod";

/** A listening TCP server's address (a pipe server would answer a string). */
const AddressSchema = z.object({ port: z.number().int().positive() });

/**
 * @param {(request: http.IncomingMessage, response: http.ServerResponse, body: string) => void} handler
 * @returns {Promise<{ url: (path: string) => string, port: number, requests: { method: string, url: string, headers: http.IncomingHttpHeaders, body: string }[], close: () => Promise<void> }>}
 */
export async function startFakeServer(handler) {
	const requests = [];
	const server = http.createServer((request, response) => {
		let body = "";
		request.setEncoding("utf8");
		request.on("data", (chunk) => {
			body += chunk;
		});
		request.on("end", () => {
			requests.push({ method: request.method ?? "", url: request.url ?? "", headers: request.headers, body });
			handler(request, response, body);
		});
	});
	await new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(undefined)));
	const { port } = AddressSchema.parse(server.address());
	return {
		port,
		requests,
		url: (path) => `http://127.0.0.1:${String(port)}${path}`,
		close: () => new Promise((resolve) => server.close(() => resolve(undefined))),
	};
}

/** A port nothing listens on: bind an ephemeral port, then release it. */
export async function closedPort() {
	const server = http.createServer();
	await new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(undefined)));
	const { port } = AddressSchema.parse(server.address());
	await new Promise((resolve) => server.close(() => resolve(undefined)));
	return port;
}
