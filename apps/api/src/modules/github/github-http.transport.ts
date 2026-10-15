// ============================================
// github-http.transport.ts - The one place a request is sent to GitHub
// ============================================
// Every request: a token, an explicit timeout, GitHub's API version, GitHub's
// failures translated into typed application errors, and the body parsed with a
// wire schema before anything reads it. The token is passed per request — the
// server's read-only `GITHUB_TOKEN` (contributions, ADR 045) or an admin's own
// linked token (pull requests, ADR 052) — so both integrations share one set of
// rules for talking to GitHub.

import { HttpStatus, Inject, Injectable, Logger } from "@nestjs/common";
import { JsonValueSchema, toGithubFullName, type JsonValue } from "@workspace/shared";
import { z } from "zod";

import { TypedConfigService } from "../../config/typed-config.service";
import {
	GITHUB_GRAPHQL_API_URL,
	GITHUB_JSON_MEDIA_TYPE,
	GITHUB_RAW_MEDIA_TYPE,
	GITHUB_RATE_LIMIT_REMAINING_HEADER,
	GITHUB_REST_API_VERSION,
	GITHUB_RETRY_AFTER_HEADER,
} from "./github.constants";
import {
	describeTarget,
	GithubCommitNotFoundError,
	GithubContentNotFoundError,
	GithubRepositoryFileNotFoundError,
	type GithubTokenWritePermission,
	GithubLinkedTokenRejectedError,
	GithubPullRequestNotFoundError,
	GithubRepositoryNotFoundError,
	GithubResponseError,
	GithubUnavailableError,
	GithubWriteRejectedError,
	type GithubReadTarget,
} from "./github.errors";
import type { GithubGraphqlEnvelopeWire } from "./github.wire-schemas";

/** The HTTP boundary — `fetch` in production, a fake in tests. */
export type GithubFetch = (url: string, init: RequestInit) => Promise<Response>;

export const GITHUB_FETCH = Symbol("GITHUB_FETCH");

/** Production binding of {@link GITHUB_FETCH}: the runtime's global `fetch`. */
export const GLOBAL_GITHUB_FETCH: GithubFetch = (url: string, init: RequestInit): Promise<Response> => fetch(url, init);

/**
 * The token a request is made with. `server`: the API's own `GITHUB_TOKEN`.
 * `linked`: an admin's own token — GitHub rejecting it is the admin's to fix
 * (link a new one), not an outage.
 */
export type GithubCredential = { readonly source: "server"; readonly token: string } | { readonly source: "linked"; readonly token: string };

/** GraphQL variables — scalars only, never interpolated into the query text. */
export type GithubGraphqlVariables = Readonly<Record<string, string | number | boolean | null>>;

/** GitHub's GraphQL error kinds the transport branches on. */
const GRAPHQL_NOT_FOUND = "NOT_FOUND";
const GRAPHQL_RATE_LIMITED = "RATE_LIMITED";

/** The statuses GitHub answers with that the transport branches on (`Response.status` is a plain number). */
const STATUS_UNAUTHORIZED: number = HttpStatus.UNAUTHORIZED;
const STATUS_FORBIDDEN: number = HttpStatus.FORBIDDEN;
const STATUS_NOT_FOUND: number = HttpStatus.NOT_FOUND;
const STATUS_METHOD_NOT_ALLOWED: number = HttpStatus.METHOD_NOT_ALLOWED;
const STATUS_CONFLICT: number = HttpStatus.CONFLICT;
const STATUS_UNPROCESSABLE_ENTITY: number = HttpStatus.UNPROCESSABLE_ENTITY;
const STATUS_TOO_MANY_REQUESTS: number = HttpStatus.TOO_MANY_REQUESTS;

/** The name `AbortSignal.timeout()` gives the error it aborts with. */
const TIMEOUT_ERROR_NAME = "TimeoutError";

@Injectable()
export class GithubHttpTransport {
	private readonly logger: Logger = new Logger(GithubHttpTransport.name);

	public constructor(
		private readonly config: TypedConfigService,
		@Inject(GITHUB_FETCH) private readonly fetchGithub: GithubFetch,
	) {}

	/** POSTs one GraphQL query; GraphQL-level errors become the same typed errors as HTTP ones. */
	public async graphql<T extends GithubGraphqlEnvelopeWire>(
		credential: GithubCredential,
		schema: z.ZodType<T>,
		query: string,
		target: GithubReadTarget,
		variables: GithubGraphqlVariables,
	): Promise<T> {
		return this.graphqlRequest(credential, schema, query, target, variables);
	}

	private async graphqlRequest<T extends GithubGraphqlEnvelopeWire>(
		credential: GithubCredential,
		schema: z.ZodType<T>,
		document: string,
		target: GithubReadTarget,
		variables: GithubGraphqlVariables,
	): Promise<T> {
		const response = await this.send(credential, GITHUB_GRAPHQL_API_URL, { method: "POST", body: JSON.stringify({ query: document, variables }) }, target);
		const envelope = await this.parseBody(response, schema, target);
		const errors = envelope.errors ?? [];
		if (errors.some((error): boolean => error.type === GRAPHQL_NOT_FOUND)) {
			throw notFound(target, "GraphQL NOT_FOUND");
		}
		if (errors.some((error): boolean => error.type === GRAPHQL_RATE_LIMITED)) {
			throw this.rateLimited(target);
		}
		if (errors.length > 0) {
			throw new GithubResponseError("graphql-error", target, errors.map((error): string => `${error.type ?? "UNKNOWN"}: ${error.message}`).join("; "));
		}
		return envelope;
	}

	/** One authenticated request with the configured timeout; any non-2xx status is thrown as a typed error. */
	public async send(credential: GithubCredential, url: string, init: RequestInit, target: GithubReadTarget): Promise<Response> {
		return this.ok(credential, await this.request(credential, url, init, target, GITHUB_JSON_MEDIA_TYPE), target);
	}

	/** As {@link send}, for a file's own bytes (`application/vnd.github.raw+json`) instead of its JSON description. */
	public async sendRaw(credential: GithubCredential, url: string, target: GithubReadTarget): Promise<Response> {
		return this.ok(credential, await this.request(credential, url, { method: "GET" }, target, GITHUB_RAW_MEDIA_TYPE), target);
	}

	private ok(credential: GithubCredential, response: Response, target: GithubReadTarget): Response {
		if (response.ok) {
			return response;
		}
		throw this.statusError(credential, response, target);
	}

	/**
	 * GETs one of GitHub's own signed download links (an upload to a private repository, read from
	 * its rendered body). The link is the credential, so no token is sent with it; a link GitHub
	 * refuses or that has expired is "not found" for `target`.
	 */
	public async downloadSigned(url: string, target: GithubReadTarget): Promise<Response> {
		const response = await this.fetchWithTimeout(url, { method: "GET", headers: { "User-Agent": this.config.runtime.appName } }, target);
		if (!response.ok) {
			throw notFound(target, `signed link answered HTTP ${String(response.status)}`);
		}
		return response;
	}

	/** The request itself: a timeout or a failed connection is {@link GithubUnavailableError}; any status is returned. */
	private async request(credential: GithubCredential, url: string, init: RequestInit, target: GithubReadTarget, accept: string): Promise<Response> {
		return this.fetchWithTimeout(
			url,
			{
				...init,
				headers: {
					Accept: accept,
					Authorization: `Bearer ${credential.token}`,
					"Content-Type": "application/json",
					"User-Agent": this.config.runtime.appName,
					"X-GitHub-Api-Version": GITHUB_REST_API_VERSION,
				},
			},
			target,
		);
	}

	private async fetchWithTimeout(url: string, init: RequestInit, target: GithubReadTarget): Promise<Response> {
		const { requestTimeoutMs } = this.config.github;
		try {
			return await this.fetchGithub(url, { ...init, signal: AbortSignal.timeout(requestTimeoutMs) });
		} catch (error: unknown) {
			const cause = error instanceof Error ? error : undefined;
			const timedOut = cause?.name === TIMEOUT_ERROR_NAME;
			this.logger.warn(`GitHub request for ${describeTarget(target)} ${timedOut ? `timed out after ${String(requestTimeoutMs)} ms` : "could not be sent"}`);
			throw new GithubUnavailableError(timedOut ? "timeout" : "unreachable", cause);
		}
	}

	/**
	 * POSTs a JSON body as the credential's account (REST). As {@link send},
	 * except that GitHub refusing the write — 403 that is not a rate limit, or
	 * 422 — is a {@link GithubWriteRejectedError} the person can act on, not an
	 * outage; a 403 names `permission`, the one the token is missing.
	 */
	public async post(credential: GithubCredential, url: string, body: JsonValue, target: GithubReadTarget, permission: GithubTokenWritePermission): Promise<Response> {
		return this.write(credential, url, { method: "POST", body: JSON.stringify(body) }, target, permission);
	}

	/** PUTs a JSON body, with the same refusals as {@link post}. */
	public async put(credential: GithubCredential, url: string, body: JsonValue, target: GithubReadTarget, permission: GithubTokenWritePermission): Promise<Response> {
		return this.write(credential, url, { method: "PUT", body: JSON.stringify(body) }, target, permission);
	}

	/** PATCHes a JSON body, with the same refusals as {@link post}. */
	public async patch(credential: GithubCredential, url: string, body: JsonValue, target: GithubReadTarget, permission: GithubTokenWritePermission): Promise<Response> {
		return this.write(credential, url, { method: "PATCH", body: JSON.stringify(body) }, target, permission);
	}

	/** DELETEs, with the same refusals as {@link post}. */
	public async delete(credential: GithubCredential, url: string, target: GithubReadTarget, permission: GithubTokenWritePermission): Promise<Response> {
		return this.write(credential, url, { method: "DELETE" }, target, permission);
	}

	private async write(credential: GithubCredential, url: string, init: RequestInit, target: GithubReadTarget, permission: GithubTokenWritePermission): Promise<Response> {
		const response = await this.request(credential, url, init, target, GITHUB_JSON_MEDIA_TYPE);
		if (response.ok) {
			return response;
		}
		const forbidden = response.status === STATUS_FORBIDDEN && !isRateLimitResponse(response);
		if (forbidden || WRITE_REFUSAL_STATUSES.has(response.status)) {
			const reason = await githubReasonOf(response);
			this.logger.warn(`GitHub refused a write to ${describeTarget(target)}: HTTP ${String(response.status)} ${reason}`);
			throw new GithubWriteRejectedError(forbidden ? "forbidden" : "unprocessable", reason, repositoryOf(target), permission);
		}
		throw this.statusError(credential, response, target);
	}

	/** Reads and validates a JSON body — a body that is not JSON, or not the expected shape, is a {@link GithubResponseError}. */
	public async parseBody<T>(response: Response, schema: z.ZodType<T>, target: GithubReadTarget): Promise<T> {
		const text = await response.text();
		let json: JsonValue;
		try {
			json = JsonValueSchema.parse(JSON.parse(text));
		} catch (error: unknown) {
			throw new GithubResponseError("unexpected-body", target, `not JSON (${error instanceof Error ? error.message : "parse failed"})`);
		}
		const parsed = schema.safeParse(json);
		if (!parsed.success) {
			throw new GithubResponseError("unexpected-body", target, parsed.error.issues.map((issue): string => `${issue.path.join(".")}: ${issue.message}`).join("; "));
		}
		return parsed.data;
	}

	private statusError(credential: GithubCredential, response: Response, target: GithubReadTarget): Error {
		// GitHub answers an unknown SHA with 422 ("No commit found for SHA"), an unknown repository with 404.
		if (response.status === STATUS_NOT_FOUND || (response.status === STATUS_UNPROCESSABLE_ENTITY && target.kind === "commit")) {
			return notFound(target, `HTTP ${String(response.status)}`);
		}
		if (response.status === STATUS_TOO_MANY_REQUESTS || (response.status === STATUS_FORBIDDEN && isRateLimitResponse(response))) {
			return this.rateLimited(target);
		}
		if (response.status === STATUS_UNAUTHORIZED) {
			if (credential.source === "linked") {
				this.logger.warn(`GitHub rejected a linked token reading ${describeTarget(target)} — its owner must link a new one`);
				return new GithubLinkedTokenRejectedError();
			}
			this.logger.error(`GitHub rejected GITHUB_TOKEN reading ${describeTarget(target)} — check the token has not expired or been revoked`);
			return new GithubResponseError("credentials-rejected", target, "401 Unauthorized");
		}
		return new GithubResponseError("unexpected-status", target, `HTTP ${String(response.status)}`);
	}

	private rateLimited(target: GithubReadTarget): GithubUnavailableError {
		this.logger.warn(`GitHub rate limit used up while reading ${describeTarget(target)}`);
		return new GithubUnavailableError("rate-limited");
	}
}

/** GitHub's REST error body: a message, and for a 422 the specific reasons. */
const GithubRestErrorWireSchema = z.object({
	message: z.string().optional(),
	/** A reason is a string, or an object with a message, depending on the endpoint. */
	errors: z.array(z.union([z.string(), z.object({ message: z.string() }).transform((error): string => error.message)])).optional(),
});

/** Why GitHub refused a request, in its own words ("Can not approve your own pull request"). */
async function githubReasonOf(response: Response): Promise<string> {
	const text = await response.text();
	let json: JsonValue = null;
	try {
		json = JsonValueSchema.parse(JSON.parse(text));
	} catch {
		return `HTTP ${String(response.status)}`;
	}
	const parsed = GithubRestErrorWireSchema.safeParse(json);
	if (!parsed.success) {
		return `HTTP ${String(response.status)}`;
	}
	const details = parsed.data.errors ?? [];
	return details.length > 0 ? details.join(" ") : (parsed.data.message ?? `HTTP ${String(response.status)}`);
}

/** `owner/repository` of what a write was aimed at, for the person-facing message. */
function repositoryOf(target: GithubReadTarget): string {
	switch (target.kind) {
		case "repository":
		case "commit":
		case "pullRequest":
		case "repositoryFile":
			return toGithubFullName(target.params);
		case "content":
		case "account":
		case "linkedAccount":
		case "search":
			return "this repository";
	}
}

/** A 404 names what was read; for an account it means GitHub answered unexpectedly. */
function notFound(target: GithubReadTarget, detail: string): Error {
	switch (target.kind) {
		case "repository":
			return new GithubRepositoryNotFoundError(target.params);
		case "commit":
			return new GithubCommitNotFoundError(target.params);
		case "pullRequest":
			return new GithubPullRequestNotFoundError(target.params);
		case "content":
			return new GithubContentNotFoundError(target.nodeId);
		case "repositoryFile":
			return new GithubRepositoryFileNotFoundError(target.params);
		case "account":
		case "linkedAccount":
		case "search":
			return new GithubResponseError("unexpected-status", target, detail);
	}
}

/**
 * Statuses with which GitHub refuses a write on its own rules — its reason is shown as it is:
 * 405 (a pull request that cannot be merged), 409 (its head moved on since it was read), 422.
 */
const WRITE_REFUSAL_STATUSES: ReadonlySet<number> = new Set<number>([STATUS_METHOD_NOT_ALLOWED, STATUS_CONFLICT, STATUS_UNPROCESSABLE_ENTITY]);

/** GitHub answers a used-up primary or secondary rate limit with 403 plus one of these headers. */
function isRateLimitResponse(response: Response): boolean {
	return response.headers.get(GITHUB_RATE_LIMIT_REMAINING_HEADER) === "0" || response.headers.has(GITHUB_RETRY_AFTER_HEADER);
}
