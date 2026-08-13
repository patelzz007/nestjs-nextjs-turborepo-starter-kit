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

import type { TelescopeRequestListResponse } from "@workspace/shared";

const BASE_URL: string = process.env.TELESCOPE_URL ?? "http://localhost:8080";

function printUsage(): void {
	console.error(
		[
			"Usage: telescope:cli <command> [args]",
			"",
			"  requests [--limit N]          List recent requests (default 20)",
			"  view <requestId>              Full detail for one request",
			"  compare <idA> <idB>           Scalar diff between two requests",
			"",
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

	const response: Response = await fetch(`${BASE_URL}/auth/login`, {
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
	const response: Response = await fetch(`${BASE_URL}${path}`, { headers });
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

	printUsage();
}

void main();
