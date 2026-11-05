// ============================================
// platform/infrastructure/http/outbound/guarded-http-client.ts — POST to an untrusted URL, SSRF-safe
// ============================================
// One request to an address a tenant or user typed (ADR 082). The URL passes `checkOutboundUrl` first;
// then the connection resolves the host through a guarded lookup: every address DNS returns must be
// allowed, and the socket connects to exactly that checked address (no second lookup an attacker's DNS
// could answer differently — DNS rebinding). Redirects are never followed (a 3xx is just the answer),
// the whole exchange has a deadline, and at most `maxResponseBytes` of the answer are read.

import { lookup as dnsLookup, type LookupAddress, type LookupOptions } from "node:dns";
import { request as httpRequest, type ClientRequest, type IncomingMessage, type RequestOptions } from "node:http";
import { request as httpsRequest } from "node:https";
import type { LookupFunction } from "node:net";

import { checkOutboundUrl, HTTPS_PROTOCOL, isAllowedOutboundAddress, type OutboundRefusalReason, type OutboundTargetPolicy } from "./outbound-target-policy";

/** Resolves every address of a host name (`dns.lookup` with `all: true`). */
export type HostResolver = (hostname: string) => Promise<readonly LookupAddress[]>;

/** The system resolver: the same one Node's own connections use. */
export const SYSTEM_HOST_RESOLVER: HostResolver = (hostname: string): Promise<readonly LookupAddress[]> =>
	new Promise<readonly LookupAddress[]>((resolve, reject): void => {
		dnsLookup(hostname, { all: true, order: "verbatim" }, (error: NodeJS.ErrnoException | null, addresses: LookupAddress[]): void => {
			if (error !== null) {
				reject(error);
				return;
			}
			resolve(addresses);
		});
	});

/** A host resolved to an address the policy refuses: thrown from the lookup, so the connection never opens. */
export class OutboundAddressBlockedError extends Error {
	public constructor(
		public readonly hostname: string,
		public readonly address: string,
	) {
		super(`${hostname} resolves to ${address}, a private, local or reserved address`);
		this.name = "OutboundAddressBlockedError";
	}
}

class OutboundTimeoutError extends Error {
	public constructor(timeoutMs: number) {
		super(`No answer within ${String(timeoutMs)} ms`);
		this.name = "OutboundTimeoutError";
	}
}

class OutboundHostNotFoundError extends Error {
	public constructor(hostname: string) {
		super(`${hostname} has no address`);
		this.name = "OutboundHostNotFoundError";
	}
}

/**
 * A `net` lookup that refuses a host when ANY of its addresses is not allowed (a mixed answer is how a
 * rebinding attack hides a private address behind a public one), and otherwise hands the connection the
 * checked addresses.
 */
export function createGuardedLookup(policy: OutboundTargetPolicy, resolver: HostResolver): LookupFunction {
	return (hostname: string, options: LookupOptions, callback: (error: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void): void => {
		resolver(hostname)
			.then((addresses: readonly LookupAddress[]): void => {
				const blocked = addresses.find((entry: LookupAddress): boolean => !isAllowedOutboundAddress(entry.address, policy));
				if (blocked !== undefined) {
					callback(new OutboundAddressBlockedError(hostname, blocked.address), "");
					return;
				}
				const wanted = options.family === undefined || options.family === 0 ? addresses : addresses.filter((entry: LookupAddress): boolean => entry.family === options.family);
				const [first] = wanted;
				if (first === undefined) {
					callback(new OutboundHostNotFoundError(hostname), "");
					return;
				}
				if (options.all === true) {
					callback(null, [...wanted]);
					return;
				}
				callback(null, first.address, first.family);
			})
			.catch((error: unknown): void => {
				callback(error instanceof Error ? error : new OutboundHostNotFoundError(hostname), "");
			});
	};
}

/** One POST. Header names and values are the caller's own (never user input). */
export interface OutboundPostRequest {
	readonly url: string;
	readonly body: string;
	readonly headers: Readonly<Record<string, string>>;
	/** Deadline for the whole exchange (connect, send, answer). */
	readonly timeoutMs: number;
	/** At most this much of the answer is read; the rest is dropped. */
	readonly maxResponseBytes: number;
}

/** What came of one POST. */
export type OutboundPostResult =
	/** The endpoint answered (any status, 3xx included: redirects are not followed). */
	| { readonly kind: "answered"; readonly status: number; readonly bodyExcerpt: string; readonly durationMs: number }
	/** The URL or an address it resolves to is not allowed: nothing was sent. */
	| { readonly kind: "refused"; readonly reason: OutboundRefusalReason; readonly message: string; readonly durationMs: number }
	/** No answer within the deadline. */
	| { readonly kind: "timed_out"; readonly message: string; readonly durationMs: number }
	/** The connection failed (DNS, refused, reset, TLS). */
	| { readonly kind: "failed"; readonly message: string; readonly durationMs: number };

type RequestSettled = { readonly kind: "answered"; readonly status: number; readonly bodyExcerpt: string } | { readonly kind: "error"; readonly error: Error };

/** A monotonic clock in milliseconds (durations only). */
export type MonotonicClock = () => number;

const MONOTONIC_CLOCK: MonotonicClock = (): number => performance.now();

/** POSTs to untrusted URLs under an {@link OutboundTargetPolicy}. Never throws: every outcome is a result. */
export class GuardedHttpClient {
	private readonly lookup: LookupFunction;

	public constructor(
		private readonly policy: OutboundTargetPolicy,
		resolver: HostResolver = SYSTEM_HOST_RESOLVER,
		private readonly now: MonotonicClock = MONOTONIC_CLOCK,
	) {
		this.lookup = createGuardedLookup(policy, resolver);
	}

	public async post(request: OutboundPostRequest): Promise<OutboundPostResult> {
		const startedAt = this.now();
		const elapsed = (): number => Math.max(0, Math.round(this.now() - startedAt));
		const checked = checkOutboundUrl(request.url, this.policy);
		if (!checked.ok) {
			return { kind: "refused", reason: checked.reason, message: checked.message, durationMs: elapsed() };
		}
		const settled = await this.send(checked.url, request);
		if (settled.kind === "answered") {
			return { ...settled, durationMs: elapsed() };
		}
		const { error } = settled;
		if (error instanceof OutboundAddressBlockedError) {
			return { kind: "refused", reason: "address_not_allowed", message: error.message, durationMs: elapsed() };
		}
		if (error instanceof OutboundTimeoutError) {
			return { kind: "timed_out", message: error.message, durationMs: elapsed() };
		}
		return { kind: "failed", message: error.message, durationMs: elapsed() };
	}

	private send(url: URL, request: OutboundPostRequest): Promise<RequestSettled> {
		return new Promise<RequestSettled>((resolve): void => {
			let isSettled = false;
			const settle = (outcome: RequestSettled): void => {
				if (!isSettled) {
					isSettled = true;
					clearTimeout(deadline);
					resolve(outcome);
				}
			};
			const options: RequestOptions = {
				method: "POST",
				headers: { ...request.headers, "content-length": String(Buffer.byteLength(request.body)) },
				lookup: this.lookup,
				// A fresh connection per request: a pooled socket would skip the guarded lookup.
				agent: false,
			};
			const onResponse = (response: IncomingMessage): void => {
				const chunks: Buffer[] = [];
				let received = 0;
				const finish = (): void => {
					const status = response.statusCode;
					settle(
						status === undefined
							? { kind: "error", error: new Error("The answer had no HTTP status") }
							: { kind: "answered", status, bodyExcerpt: Buffer.concat(chunks).toString("utf8") },
					);
				};
				response.on("data", (chunk: Buffer): void => {
					const room = request.maxResponseBytes - received;
					if (room > 0) {
						chunks.push(chunk.subarray(0, room));
					}
					received += chunk.length;
					if (received >= request.maxResponseBytes) {
						finish();
						response.destroy();
					}
				});
				response.on("end", finish);
				response.on("error", finish);
			};
			const outgoing: ClientRequest = url.protocol === HTTPS_PROTOCOL ? httpsRequest(url, options, onResponse) : httpRequest(url, options, onResponse);
			const deadline = setTimeout((): void => {
				const timeout = new OutboundTimeoutError(request.timeoutMs);
				settle({ kind: "error", error: timeout });
				outgoing.destroy(timeout);
			}, request.timeoutMs);
			outgoing.on("error", (error: Error): void => {
				settle({ kind: "error", error });
			});
			outgoing.end(request.body);
		});
	}
}
