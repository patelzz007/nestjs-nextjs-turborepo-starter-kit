// ============================================
// platform/infrastructure/http/outbound/outbound-target-policy.ts — which URLs and addresses the server may call
// ============================================
// SSRF defence for any request the server makes to an address a tenant or user typed (ADR 082): HTTPS
// only, no credentials in the URL, no single-label or `.localhost` host, and — checked on the literal
// host here and on every address DNS returns at connect time (guarded-lookup.ts) — only public
// addresses: never loopback, private, link-local (cloud metadata 169.254.169.254), carrier-grade NAT,
// documentation, multicast, reserved, or an IPv6 transition range that embeds one of those. Loopback over
// plain HTTP is let through only when `allowLoopback` is on, a development / test switch the config
// refuses in production.

import { BlockList, isIP } from "node:net";

import { classifyIpAddress } from "../ip-classification";

const IPV4_FAMILY = 4;
const IPV6_FAMILY = 6;
/** The one scheme a non-loopback target may use. */
export const HTTPS_PROTOCOL = "https:";
const HTTP_PROTOCOL = "http:";
const LOCALHOST = "localhost";
const LOCALHOST_SUFFIX = ".localhost";

/**
 * IPv6 ranges that carry (or route to) an IPv4 address, and deprecated local ranges, which the scope
 * classification does not catch in every spelling: IPv4-mapped in hex (`::ffff:7f00:1`), IPv4-compatible,
 * NAT64 (well-known and local-use), 6to4, Teredo, and site-local.
 */
const EMBEDDED_OR_LOCAL_IPV6_RANGES: readonly (readonly [network: string, prefix: number])[] = [
	["::ffff:0:0", 96],
	["::", 96],
	["64:ff9b::", 96],
	["64:ff9b:1::", 48],
	["2002::", 16],
	["2001::", 32],
	["fec0::", 10],
];

const EMBEDDED_OR_LOCAL_IPV6: BlockList = ((): BlockList => {
	const list = new BlockList();
	for (const [network, prefix] of EMBEDDED_OR_LOCAL_IPV6_RANGES) {
		list.addSubnet(network, prefix, "ipv6");
	}
	return list;
})();

/** What the server may reach. */
export interface OutboundTargetPolicy {
	/** Lets `http://localhost` and loopback addresses through: development and tests only (refused in production by the config). */
	readonly allowLoopback: boolean;
}

/** Why a URL or an address was refused. */
export type OutboundRefusalReason = "invalid_url" | "scheme_not_allowed" | "credentials_in_url" | "host_not_allowed" | "address_not_allowed";

export type OutboundUrlCheck = { readonly ok: true; readonly url: URL } | { readonly ok: false; readonly reason: OutboundRefusalReason; readonly message: string };

/** `[::1]` → `::1`: a URL writes an IPv6 literal in brackets. */
function bareHost(hostname: string): string {
	return hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
}

function isLocalhostName(host: string): boolean {
	const lower = host.toLowerCase();
	return lower === LOCALHOST || lower.endsWith(LOCALHOST_SUFFIX);
}

function isLoopbackHost(host: string): boolean {
	return isLocalhostName(host) || classifyIpAddress(host)?.scope === "LOOPBACK";
}

/** Whether the server may open a connection to `address` (an IP address, as DNS returns it). */
export function isAllowedOutboundAddress(address: string, policy: OutboundTargetPolicy): boolean {
	const classification = classifyIpAddress(address);
	if (classification === null) {
		return false;
	}
	if (classification.scope === "LOOPBACK") {
		return policy.allowLoopback;
	}
	if (classification.scope !== "PUBLIC") {
		return false;
	}
	return !(isIP(address) === IPV6_FAMILY && EMBEDDED_OR_LOCAL_IPV6.check(address, "ipv6"));
}

/**
 * The static checks on a URL before any DNS lookup. A literal IP host is checked here; a name is checked
 * again on every address it resolves to when the connection opens.
 */
export function checkOutboundUrl(raw: string, policy: OutboundTargetPolicy): OutboundUrlCheck {
	if (!URL.canParse(raw)) {
		return { ok: false, reason: "invalid_url", message: "The address is not a valid URL." };
	}
	const url = new URL(raw);
	const host = bareHost(url.hostname);
	const loopback = isLoopbackHost(host);
	if (url.protocol !== HTTPS_PROTOCOL && !(url.protocol === HTTP_PROTOCOL && loopback && policy.allowLoopback)) {
		return { ok: false, reason: "scheme_not_allowed", message: "The address must use HTTPS." };
	}
	if (url.username !== "" || url.password !== "") {
		return { ok: false, reason: "credentials_in_url", message: "The address must not contain a user name or password." };
	}
	const family = isIP(host);
	if (family === IPV4_FAMILY || family === IPV6_FAMILY) {
		return isAllowedOutboundAddress(host, policy)
			? { ok: true, url }
			: { ok: false, reason: "address_not_allowed", message: "The address points to a private, local or reserved network." };
	}
	if (isLocalhostName(host)) {
		return policy.allowLoopback ? { ok: true, url } : { ok: false, reason: "host_not_allowed", message: "The address points to this server." };
	}
	if (!host.includes(".")) {
		return { ok: false, reason: "host_not_allowed", message: "The address needs a full domain name." };
	}
	return { ok: true, url };
}
