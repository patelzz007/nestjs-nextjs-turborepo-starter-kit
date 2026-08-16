// ============================================
// scripts/telescope-cli.ts — Telescope CLI (improvement 14)
// ============================================
// Inspect captured Telescope data from the terminal — no browser needed:
//
//   pnpm --filter @workspace/api telescope:cli requests [--limit 20]
//   pnpm --filter @workspace/api telescope:cli view <requestId>
//   pnpm --filter @workspace/api telescope:cli compare <idA> <idB>
//
// Auth (in order of preference):
//   1. TELESCOPE_TOKEN (recommended — no login round-trip, CI-friendly)
//   2. ADMIN_EMAIL / ADMIN_PASSWORD (falls back to the seeded defaults)
// Set TELESCOPE_URL to point at a remote API (default http://localhost:8080).
// ============================================

/* eslint-disable no-console -- The script's output IS the printed JSON. */

import "dotenv/config";

import { TelescopeReplayInputSchema, TelescopeStreamEventSchema, type TelescopeRequestListResponse, type TelescopeSqlListResponse } from "@workspace/shared";

const BASE_URL: string = process.env.TELESCOPE_URL ?? "http://localhost:8080";
// The API serves every route under `/api/v1` (URI versioning).
const API_PREFIX = "/api/v1";

function printUsage(): void {
	console.error(
		[
			"Usage: telescope:cli <command> [args]",
			"",
			"requests [--limit N]          List recent requests (default 20)",
			"  view <requestId>              Full detail for one request",
			"  compare <idA> <idB>           Scalar diff between two requests",
			"  replay <requestId> [target]   Re-send a captured request (default target: local)",
			"  sql [--limit N]               List captured SQL queries (slowest first)",
			"  exceptions [--limit N]        List captured exceptions",
			"  watch [--json]                Tail the live SSE stream until Ctrl+C",
			"",
			"All commands accept --json for raw machine-readable output.",
			"Env: TELESCOPE_TOKEN (auth) · ADMIN_EMAIL/ADMIN_PASSWORD · TELESCOPE_URL",
		].join("\n"),
	);
}

function bail(message: string): void {
	console.error(`[telescope:cli] ${message}`);
	process.exit(1);
}

/** Builds the auth header: TELESCOPE_TOKEN first, else an admin login. */
async function authHeaders(): Promise<Record<string, string>> {
	const token: string | undefined = process.env.TELESCOPE_TOKEN;
	if (token !== undefined && token.length > 0) {
		return { authorization: `Bearer ${token}` };
	}

	const email: string = process.env.ADMIN_EMAIL ?? "admin@example.com";
	const password: string = process.env.ADMIN_PASSWORD ?? "Admin@123";

	const response: Response = await fetch(`${BASE_URL}${API_PREFIX}/auth/login`, {
		method: "POST",
		headers: { "content-type": "application/json", "x-client-type": "admin" },
		body: JSON.stringify({ email, password }),
	});
	if (!response.ok) {
		bail(`login failed (${String(response.status)}) — set TELESCOPE_TOKEN or ADMIN_EMAIL/ADMIN_PASSWORD`);
	}
	const cookieHeader: string | undefined = response.headers.getSetCookie().find((cookie: string): boolean => cookie.startsWith("adminAccessToken="));
	if (cookieHeader === undefined) {
		bail("login succeeded but no adminAccessToken cookie was returned");
	}
	return { cookie: cookieHeader.split(";")[0] ?? "" };
}

async function getJson<T>(path: string, headers: Record<string, string>): Promise<T> {
	const response: Response = await fetch(`${BASE_URL}${API_PREFIX}${path}`, { headers });
	if (!response.ok) {
		const bodyPreview: string = (await response.text()).slice(0, 300);
		bail(`GET ${path} → ${String(response.status)}: ${bodyPreview}`);
	}
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Library boundary: the JSON body is validated by the API's zod schemas before it is served.
	return (await response.json()) as T;
}

async function main(): Promise<void> {
	const args: readonly string[] = process.argv.slice(2);
	const command: string | undefined = args[0];
	const headers: Record<string, string> = await authHeaders();

	if (command === "requests") {
		const limitIndex: number = args.indexOf("--limit");
		const rawLimit: string | undefined = limitIndex >= 0 ? args[limitIndex + 1] : undefined;
		const limit: string = rawLimit ?? "20";
		const data = await getJson<{ readonly data: { readonly list: TelescopeRequestListResponse } }>(`/telescope/requests?page=1&pageSize=${limit}`, headers);
		console.log(JSON.stringify({ total: data.data.list.total, items: data.data.list.items }, null, 2));
		return;
	}

	if (command === "view") {
		const id: string | undefined = args.length > 1 ? args[1] : undefined;
		if (id === undefined) {
			printUsage();
			return;
		}
		const data = await getJson(`/telescope/requests/${encodeURIComponent(id)}`, headers);
		console.log(JSON.stringify(data, null, 2));
		return;
	}

	if (command === "compare") {
		const idA: string | undefined = args.length > 1 ? args[1] : undefined;
		const idB: string | undefined = args.length > 2 ? args[2] : undefined;
		if (idA === undefined || idB === undefined) {
			printUsage();
			return;
		}
		const data = await getJson(`/telescope/compare?a=${encodeURIComponent(idA)}&b=${encodeURIComponent(idB)}`, headers);
		console.log(JSON.stringify(data, null, 2));
		return;
	}

	if (command === "sql") {
		const limitIndex: number = args.indexOf("--limit");
		const rawLimit: string | undefined = limitIndex >= 0 ? args[limitIndex + 1] : undefined;
		const limit: string = rawLimit ?? "20";
		const data = await getJson<{ readonly data: { readonly list: TelescopeSqlListResponse } }>(
			`/telescope/sql?page=1&pageSize=${limit}&sortBy=duration&sortDir=desc`,
			headers,
		);
		console.log(JSON.stringify({ total: data.data.list.total, items: data.data.list.items }, null, 2));
		return;
	}

	if (command === "exceptions") {
		const limitIndex: number = args.indexOf("--limit");
		const rawLimit: string | undefined = limitIndex >= 0 ? args[limitIndex + 1] : undefined;
		const limit: string = rawLimit ?? "20";
		const data = await getJson<{ readonly data: { readonly list: TelescopeExceptionListResponse } }>(`/telescope/exceptions?page=1&pageSize=${limit}`, headers);
		console.log(JSON.stringify({ total: data.data.list.total, items: data.data.list.items }, null, 2));
		return;
	}

	if (command === "watch") {
		const jsonMode: boolean = args.includes("--json");
		// The stream must declare `Accept: text/event-stream` — the global
		// ResponseInterceptor bypasses its envelope only for that Accept, so
		// without it every frame arrives wrapped (improvement 7 wire contract).
		const response: Response = await fetch(`${BASE_URL}${API_PREFIX}/telescope/stream`, {
			headers: { ...headers, accept: "text/event-stream" },
		});
		if (!response.ok) {
			bail(`GET /telescope/stream → ${String(response.status)}`);
		}
		if (response.body === null) {
			bail("stream returned an empty body");
		}
		const decoder: TextDecoder = new TextDecoder();
		const reader: ReadableStreamDefaultReader<Uint8Array> = response.body.getReader();
		let buffer = "";

		for (;;) {
			const { done, value } = await reader.read();
			if (done || value === undefined) {
				break;
			}
			const chunk: string = decoder.decode(value, { stream: true });
			buffer += chunk;
			const blocks: string[] = buffer.split("\n\n");
			buffer = blocks.pop() ?? "";
			for (const block of blocks) {
				const dataLine: string | undefined = block.split("\n").find((line: string): boolean => line.startsWith("data:"));
				if (dataLine === undefined) {
					continue;
				}
				const parsed = TelescopeStreamEventSchema.safeParse(JSON.parse(dataLine.slice(5).trim()));
				if (!parsed.success) {
					console.error(`[telescope:cli] non-JSON SSE frame: ${dataLine.slice(5, 125)}`);
					continue;
				}
				if (jsonMode) {
					console.log(JSON.stringify(parsed.data));
				} else {
					const { type, id, ...rest } = parsed.data;
					console.log(`[${type}] ${id} — ${JSON.stringify(rest).slice(0, 140)}`);
				}
			}
		}
		return;
	}

	// Feature 7 — replay a captured request against a configured target.
	if (command === "replay") {
		const id: string | undefined = args.length > 1 ? args[1] : undefined;
		const target: string = args.length > 2 ? args[2] : "local";
		if (id === undefined) {
			printUsage();
			return;
		}
		const input = TelescopeReplayInputSchema.parse({ target });
		const response: Response = await fetch(`${BASE_URL}${API_PREFIX}/telescope/replay/${encodeURIComponent(id)}`, {
			method: "POST",
			headers: { ...headers, "content-type": "application/json" },
			body: JSON.stringify(input),
		});
		if (!response.ok) {
			const bodyPreview: string = (await response.text()).slice(0, 300);
			bail(`POST /telescope/replay/${id} → ${String(response.status)}: ${bodyPreview}`);
		}
		console.log(JSON.stringify(await response.json(), null, 2));
		return;
	}

	printUsage();
}

void main();
