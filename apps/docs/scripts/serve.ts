#!/usr/bin/env node
/**
 * The docs site in production (ADR 084): `node scripts/serve.ts`, one pm2 process behind nginx. Every page is
 * pre-rendered, so this serves `dist/client` from disk and hands the Start server only what is not a file: slug
 * redirects, search URLs and the 404 page. `vite preview` needs dev dependencies; this needs none.
 */
import { readFile, stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { z } from "zod";

import { contentTypeOf, staticCandidates } from "./static-path.ts";

/** What the Start build exports. Checked on load, so a changed build fails at start-up rather than on a request. */
const ServerEntryModuleSchema = z.object({
	default: z.object({ fetch: z.function({ input: [z.instanceof(Request)], output: z.promise(z.instanceof(Response)) }) }),
});

const EnvironmentSchema = z.object({
	PORT: z.coerce.number().int().positive().default(3002),
	HOST: z.string().default("127.0.0.1"),
});

/** Built assets carry a content hash in their name, so they never change. */
const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";
const REVALIDATE_CACHE = "public, max-age=0, must-revalidate";
const ASSETS_PREFIX = "/assets/";
const INTERNAL_ERROR_STATUS = 500;

const dist = path.resolve(import.meta.dirname, "../dist");
const clientRoot = path.join(dist, "client");
const { default: entry } = ServerEntryModuleSchema.parse(await import(pathToFileURL(path.join(dist, "server/server.js")).href));
const { PORT: port, HOST: host } = EnvironmentSchema.parse(process.env);

async function isFile(file: string): Promise<boolean> {
	try {
		return (await stat(file)).isFile();
	} catch {
		return false;
	}
}

async function serveStatic(pathname: string, response: ServerResponse): Promise<boolean> {
	for (const candidate of staticCandidates(clientRoot, pathname)) {
		if (await isFile(candidate)) {
			response.writeHead(200, { "Content-Type": contentTypeOf(candidate), "Cache-Control": pathname.startsWith(ASSETS_PREFIX) ? IMMUTABLE_CACHE : REVALIDATE_CACHE });
			response.end(await readFile(candidate));
			return true;
		}
	}
	return false;
}

function toRequest(request: IncomingMessage, url: URL): Request {
	const headers = new Headers();
	for (const [name, value] of Object.entries(request.headers)) {
		if (value !== undefined) {
			headers.set(name, value instanceof Array ? value.join(", ") : value);
		}
	}
	return new Request(url, { method: request.method ?? "GET", headers });
}

/** What reaches the Start server is small (a redirect, the 404 page, a search page), so it is answered whole. */
async function sendResponse(answer: Response, response: ServerResponse): Promise<void> {
	const body = Buffer.from(await answer.arrayBuffer());
	response.writeHead(answer.status, Object.fromEntries(answer.headers));
	response.end(body);
}

async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
	const url = new URL(request.url ?? "/", `http://${request.headers.host ?? host}`);
	const isPlainPageLoad = url.search.length === 0 && (request.method === "GET" || request.method === "HEAD");
	if (isPlainPageLoad && (await serveStatic(url.pathname, response))) {
		return;
	}
	await sendResponse(await entry.fetch(toRequest(request, url)), response);
}

createServer((request, response) => {
	handle(request, response).catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : "The request failed"}\n`);
		if (!response.headersSent) {
			response.writeHead(INTERNAL_ERROR_STATUS);
		}
		response.end();
	});
}).listen(port, host, () => {
	process.stdout.write(`Docs site on http://${host}:${String(port)}\n`);
});
