import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import { CaughtValueSchema, type RequestLogEntry, type TelescopeOptions, type TelescopeReplayInput, type TelescopeReplayResponse } from "@workspace/shared";
import { readCaughtErrorMessage } from "../../common/utils/caught-error";

import { TELESCOPE_OPTIONS, TELESCOPE_STORE } from "./telescope.options";
import type { TelescopeStore } from "./telescope.store";

const BLOCKED_HOSTS: ReadonlySet<string> = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]", "metadata.google.internal"]);

/**
 * Replay of a captured request against a configured origin only.
 * Path is joined onto that origin; user input cannot pick a base URL.
 */
@Injectable()
export class TelescopeReplayService {
	public constructor(
		@Inject(TELESCOPE_STORE) private readonly store: TelescopeStore,
		@Inject(TELESCOPE_OPTIONS) private readonly options: TelescopeOptions,
	) {}

	public async replay(requestId: string, input: TelescopeReplayInput): Promise<TelescopeReplayResponse> {
		const request: RequestLogEntry = this.requireRequest(requestId);
		const localBaseUrl: string = this.localBaseUrl();
		const targets: Record<string, string> = { local: localBaseUrl, ...this.options.replayTargets };
		if (!Object.prototype.hasOwnProperty.call(targets, input.target)) {
			throw new NotFoundException({
				message: `Unknown replay target "${input.target}". Configured targets: ${Object.keys(targets).join(", ")}.`,
				error: "TELESCOPE_REPLAY_TARGET_UNKNOWN",
			});
		}
		const baseUrl: string = targets[input.target] ?? localBaseUrl;
		const url: string = joinSameOrigin(baseUrl, request.path, request.queryString);
		assertReplayUrl(url, input.target === "local");

		const headers: Record<string, string> = {};
		if (request.requestHeaders !== null) {
			for (const [key, value] of Object.entries(request.requestHeaders)) {
				if (key.toLowerCase() === "authorization" || key.toLowerCase() === "cookie" || key.toLowerCase() === "set-cookie") {
					continue;
				}
				headers[key] = value;
			}
		}

		const start: number = performance.now();
		try {
			const response: Response = await fetch(url, {
				method: request.method,
				headers,
				body: request.method === "GET" || request.method === "HEAD" ? undefined : JSON.stringify(request.requestBody),
				signal: AbortSignal.timeout(10_000),
			});
			const rawText: string = await response.text();
			return {
				ok: response.ok,
				status: response.status,
				statusText: response.statusText,
				durationMs: Math.round(performance.now() - start),
				responsePreview: rawText.length > 500 ? `${rawText.slice(0, 497)}…` : rawText,
			};
		} catch (error) {
			const caught = CaughtValueSchema.parse(error);
			const message: string = readCaughtErrorMessage(caught).slice(0, 500);
			return {
				ok: false,
				status: null,
				statusText: "fetch failed",
				durationMs: Math.round(performance.now() - start),
				responsePreview: message,
			};
		}
	}

	private localBaseUrl(): string {
		return process.env.TELESCOPE_LOCAL_BASE_URL ?? `http://localhost:${process.env.PORT ?? "8080"}`;
	}

	private requireRequest(id: string): RequestLogEntry {
		const request: RequestLogEntry | undefined = this.store.getRequest(id);
		if (request === undefined) {
			throw new NotFoundException({ message: `Telescope request ${id} not found.`, error: "TELESCOPE_REQUEST_NOT_FOUND" });
		}
		return request;
	}
}

function joinSameOrigin(baseUrl: string, path: string, queryString: string | null): string {
	if (!path.startsWith("/") || path.startsWith("//")) {
		throw new BadRequestException({
			message: "Replay path must be a same-origin absolute path",
			error: "TELESCOPE_REPLAY_PATH_INVALID",
		});
	}
	const resolved: URL = new URL(path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
	const base: URL = new URL(baseUrl);
	if (resolved.origin !== base.origin) {
		throw new ForbiddenException({
			message: "Replay URL escaped the configured target origin",
			error: "TELESCOPE_REPLAY_SSRF",
		});
	}
	if (queryString !== null && queryString.length > 0) {
		resolved.search = queryString.startsWith("?") ? queryString.slice(1) : queryString;
	}
	return resolved.toString();
}

function assertReplayUrl(urlString: string, allowPrivate: boolean): void {
	const url: URL = new URL(urlString);
	if (url.protocol !== "http:" && url.protocol !== "https:") {
		throw new ForbiddenException({
			message: "Replay target must be http or https",
			error: "TELESCOPE_REPLAY_SSRF",
		});
	}
	const hostname: string = url.hostname.toLowerCase();
	if (allowPrivate) {
		return;
	}
	if (BLOCKED_HOSTS.has(hostname) || isPrivateIpv4(hostname)) {
		throw new ForbiddenException({
			message: "Replay target host is not allowed",
			error: "TELESCOPE_REPLAY_SSRF",
		});
	}
}

function isPrivateIpv4(hostname: string): boolean {
	const octets: string[] = hostname.split(".");
	if (octets.length !== 4) {
		return false;
	}
	const a: number = Number.parseInt(octets[0] ?? "", 10);
	const b: number = Number.parseInt(octets[1] ?? "", 10);
	if (!Number.isFinite(a) || !Number.isFinite(b)) {
		return false;
	}
	if (a === 10 || a === 127) {
		return true;
	}
	if (a === 192 && b === 168) {
		return true;
	}
	if (a === 172 && b >= 16 && b <= 31) {
		return true;
	}
	if (a === 169 && b === 254) {
		return true;
	}
	return false;
}
