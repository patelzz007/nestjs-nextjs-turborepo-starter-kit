// ============================================
// common/http/client-ip.ts — THE client-IP resolution (ADR 017)
// ============================================
// One rule, used by the request context (audit rows, session devices,
// impersonation logs), Fastify's `request.ip` (same trusted-proxy list) and
// every rate-limit tracker:
//
//   - No trusted proxies configured (`TRUST_PROXY` unset — the default):
//     the client IP is the TCP peer. Forwarding headers are ignored entirely,
//     because any client can send them.
//   - Trusted proxies configured: walk from the TCP peer back through
//     `X-Forwarded-For` (right to left) and take the first address that is
//     NOT a trusted proxy. A client can prepend whatever it likes to
//     `X-Forwarded-For`; it can never make an untrusted hop look trusted.
//     These are the semantics of Fastify's `trustProxy` (proxy-addr).
//
// `cf-connecting-ip` / `x-real-ip` are deliberately NOT read: cloudflared and
// reverse proxies also set `X-Forwarded-For`, which is resolved above with the
// trust boundary enforced.

import { BlockList, isIP } from "node:net";

import { z } from "zod";

/** Named address ranges accepted in `TRUST_PROXY` (the names proxy-addr / Fastify use). */
const TRUSTED_PROXY_PRESETS: Readonly<Record<"loopback" | "linklocal" | "uniquelocal", readonly string[]>> = {
	loopback: ["127.0.0.0/8", "::1/128"],
	linklocal: ["169.254.0.0/16", "fe80::/10"],
	uniquelocal: ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "fc00::/7"],
};

const TrustedProxyPresetSchema = z.enum(["loopback", "linklocal", "uniquelocal"]);

/** Largest prefix length per IP family. */
const MAX_PREFIX_BITS_V4 = 32;
const MAX_PREFIX_BITS_V6 = 128;
const IPV4_FAMILY = 4;

/** An IPv4-mapped IPv6 socket address (`::ffff:127.0.0.1`) — compared as its IPv4 form. */
const IPV4_MAPPED_PREFIX = "::ffff:";

/** True for one `TRUST_PROXY` entry: a preset name, an IP address, or `address/prefix`. */
function isTrustedProxyEntry(entry: string): boolean {
	if (TrustedProxyPresetSchema.safeParse(entry).success) {
		return true;
	}
	const [address, prefix, ...rest] = entry.split("/");
	if (address === undefined || rest.length > 0) {
		return false;
	}
	const family: number = isIP(address);
	if (family === 0) {
		return false;
	}
	if (prefix === undefined) {
		return true;
	}
	const bits = Number(prefix);
	return /^\d{1,3}$/.test(prefix) && bits <= (family === IPV4_FAMILY ? MAX_PREFIX_BITS_V4 : MAX_PREFIX_BITS_V6);
}

/** Values of `TRUST_PROXY` that mean "trust no proxy". */
const TRUST_NO_PROXY_VALUES: ReadonlySet<string> = new Set<string>(["", "0", "false", "off"]);
/** Values that used to mean "trust every peer" — refused: that makes `X-Forwarded-For` spoofable. */
const TRUST_ANY_PROXY_VALUES: ReadonlySet<string> = new Set<string>(["1", "true", "on", "*"]);

/**
 * `TRUST_PROXY`: unset/`0`/`false`/`off` → trust no proxy (the client IP is
 * the TCP peer); otherwise a comma-separated list of the proxies that sit in
 * front of the API — IPs, CIDRs (`10.0.0.0/8`) or `loopback` / `linklocal` /
 * `uniquelocal`. "Trust everything" (`1`/`true`) is rejected.
 */
export const TrustProxyEnvSchema = z
	.string()
	.optional()
	.transform((raw: string | undefined): string => (raw ?? "").trim())
	.superRefine((value: string, context): void => {
		if (TRUST_ANY_PROXY_VALUES.has(value.toLowerCase())) {
			context.addIssue({
				code: "custom",
				message: "must list the trusted proxies (IPs, CIDRs, or loopback/linklocal/uniquelocal) — trusting every peer would let any client spoof its IP",
			});
			return;
		}
		if (TRUST_NO_PROXY_VALUES.has(value.toLowerCase())) {
			return;
		}
		const invalid: string[] = value
			.split(",")
			.map((entry: string): string => entry.trim())
			.filter((entry: string): boolean => !isTrustedProxyEntry(entry));
		if (invalid.length > 0) {
			context.addIssue({ code: "custom", message: `has invalid entries: ${invalid.join(", ")} (expected IPs, CIDRs, or loopback/linklocal/uniquelocal)` });
		}
	})
	.transform((value: string): readonly string[] =>
		TRUST_NO_PROXY_VALUES.has(value.toLowerCase())
			? []
			: value
					.split(",")
					.map((entry: string): string => entry.trim())
					.filter((entry: string): boolean => entry.length > 0),
	);

/** Normalize a socket / header address for matching (`::ffff:a.b.c.d` → `a.b.c.d`). */
function normalizeAddress(address: string): string {
	const trimmed: string = address.trim();
	const unmapped: string = trimmed.toLowerCase().startsWith(IPV4_MAPPED_PREFIX) ? trimmed.slice(IPV4_MAPPED_PREFIX.length) : trimmed;
	return isIP(unmapped) === IPV4_FAMILY ? unmapped : trimmed;
}

/** The configured set of trusted proxies, compiled once. */
export class TrustedProxies {
	private readonly blockList: BlockList = new BlockList();
	public readonly isEmpty: boolean;

	public constructor(public readonly entries: readonly string[]) {
		this.isEmpty = entries.length === 0;
		for (const entry of entries) {
			const preset = TrustedProxyPresetSchema.safeParse(entry);
			for (const range of preset.success ? TRUSTED_PROXY_PRESETS[preset.data] : [entry]) {
				this.add(range);
			}
		}
	}

	/** True when `address` belongs to a trusted proxy. */
	public isTrusted(address: string): boolean {
		const normalized: string = normalizeAddress(address);
		const family: number = isIP(normalized);
		if (family === 0) {
			return false;
		}
		return this.blockList.check(normalized, family === IPV4_FAMILY ? "ipv4" : "ipv6");
	}

	/** The value for Fastify's `trustProxy` option — identical semantics. */
	public toFastifyTrustProxy(): false | string[] {
		return this.isEmpty ? false : [...this.entries];
	}

	private add(range: string): void {
		const [address, prefix] = range.split("/");
		if (address === undefined) {
			return;
		}
		const family: number = isIP(address);
		const type: "ipv4" | "ipv6" = family === IPV4_FAMILY ? "ipv4" : "ipv6";
		if (prefix === undefined) {
			this.blockList.addAddress(address, type);
			return;
		}
		this.blockList.addSubnet(address, Number(prefix), type);
	}
}

/**
 * The client IP of one request: the TCP peer, or — through trusted proxies
 * only — the first untrusted address walking `X-Forwarded-For` right to left.
 */
export function resolveClientIp(socketAddress: string | undefined, forwardedFor: string | undefined, trusted: TrustedProxies): string | undefined {
	if (socketAddress === undefined) {
		return undefined;
	}
	if (trusted.isEmpty || !trusted.isTrusted(socketAddress) || forwardedFor === undefined) {
		return normalizeAddress(socketAddress);
	}
	const hops: string[] = forwardedFor
		.split(",")
		.map((hop: string): string => hop.trim())
		.filter((hop: string): boolean => hop.length > 0);
	let client: string = normalizeAddress(socketAddress);
	for (let index = hops.length - 1; index >= 0; index -= 1) {
		const hop: string | undefined = hops[index];
		if (hop === undefined || isIP(normalizeAddress(hop)) === 0) {
			// A malformed hop ends the trusted chain: report the last proxy that handed it over.
			return client;
		}
		client = normalizeAddress(hop);
		if (!trusted.isTrusted(hop)) {
			return client;
		}
	}
	return client;
}

/** Fallback tracker key when a request carries no IP at all. */
export const UNKNOWN_CLIENT_TRACKER = "unknown";

const TrackedRequestSchema = z.object({ ip: z.string().min(1) });

/**
 * Rate-limit tracker key: Fastify's `request.ip`, which Fastify computes with
 * exactly the trusted-proxy list above (`trustProxy` in bootstrap-app.ts) —
 * so the throttlers, the request context and the audit trail always agree,
 * and no forwarding header is ever read here directly.
 */
export function throttleTrackerFor(request: object): string {
	const parsed = TrackedRequestSchema.safeParse(request);
	return parsed.success ? normalizeAddress(parsed.data.ip) : UNKNOWN_CLIENT_TRACKER;
}
