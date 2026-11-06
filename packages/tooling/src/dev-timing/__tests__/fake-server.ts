/**
 * A real HTTP server on an ephemeral loopback port, answering with whatever
 * the test's handler decides — the stand-in for a dev server in the probe
 * tests (plan §19.1: no test spawns the real stack).
 */
import http from "node:http";

import { z } from "zod";

/** A listening TCP server's address (a pipe server would answer a string). */
const AddressSchema = z.object({ port: z.number().int().positive() });

/** A test server's handler. */
export type FakeHandler = (request: http.IncomingMessage, response: http.ServerResponse, body: string) => void;

/** One request the fake server received. */
export interface RecordedRequest {
	method: string;
	url: string;
	headers: http.IncomingHttpHeaders;
	body: string;
}

/** A running fake server. */
export interface FakeServer {
	port: number;
	requests: RecordedRequest[];
	url: (path: string) => string;
	close: () => Promise<void>;
}

export async function startFakeServer(handler: FakeHandler): Promise<FakeServer> {
	const requests: RecordedRequest[] = [];
	const server = http.createServer((request, response) => {
		let body = "";
		request.setEncoding("utf8");
		request.on("data", (chunk: string) => {
			body += chunk;
		});
		request.on("end", () => {
			requests.push({ method: request.method ?? "", url: request.url ?? "", headers: request.headers, body });
			handler(request, response, body);
		});
	});
	await new Promise((resolve) =>
		server.listen(0, "127.0.0.1", () => {
			resolve(undefined);
		}),
	);
	const { port } = AddressSchema.parse(server.address());
	return {
		port,
		requests,
		url: (path: string): string => `http://127.0.0.1:${String(port)}${path}`,
		close: () =>
			new Promise<void>((resolve) =>
				server.close(() => {
					resolve();
				}),
			),
	};
}

/** A port nothing listens on: bind an ephemeral port, then release it. */
export async function closedPort(): Promise<number> {
	const server = http.createServer();
	await new Promise((resolve) =>
		server.listen(0, "127.0.0.1", () => {
			resolve(undefined);
		}),
	);
	const { port } = AddressSchema.parse(server.address());
	await new Promise<void>((resolve) =>
		server.close(() => {
			resolve();
		}),
	);
	return port;
}
