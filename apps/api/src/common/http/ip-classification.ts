// ============================================
// common/http/ip-classification.ts — what kind of address a client IP is
// ============================================
// Pure, dependency-free (Node's built-in `net.BlockList`). Classifies an
// address against the IANA special-purpose registries so an investigator can
// tell a real internet client from a private-network, loopback or carrier-NAT
// caller at a glance. Geography is NOT derivable from the address without a
// GeoIP database — see edge-location.ts for what the CDN edge tells us.

import { BlockList, isIP } from "node:net";

import { LIST_SLOT_INDEX, type IpAddressScope } from "@workspace/shared";

import { normalizeAddress } from "./client-ip";

const IPV4_FAMILY = 4;
const IPV6_FAMILY = 6;

/** IP version of a classified address. */
export type IpVersion = typeof IPV4_FAMILY | typeof IPV6_FAMILY;

export interface IpClassification {
	readonly version: IpVersion;
	readonly scope: IpAddressScope;
}

/** Special-purpose ranges per scope, checked in this order (anything else is PUBLIC). */
const SPECIAL_PURPOSE_RANGES: readonly (readonly [Exclude<IpAddressScope, "PUBLIC">, readonly string[]])[] = [
	["LOOPBACK", ["127.0.0.0/8", "::1/128"]],
	["PRIVATE", ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "fc00::/7"]],
	["LINK_LOCAL", ["169.254.0.0/16", "fe80::/10"]],
	["SHARED", ["100.64.0.0/10"]],
	["DOCUMENTATION", ["192.0.2.0/24", "198.51.100.0/24", "203.0.113.0/24", "198.18.0.0/15", "2001:db8::/32", "3fff::/20"]],
	["MULTICAST", ["224.0.0.0/4", "ff00::/8"]],
	["RESERVED", ["0.0.0.0/8", "192.0.0.0/24", "240.0.0.0/4", "255.255.255.255/32", "::/128", "100::/64"]],
];

function compile(ranges: readonly string[]): BlockList {
	const list = new BlockList();
	for (const range of ranges) {
		const [network, prefix] = range.split("/");
		if (network !== undefined && prefix !== undefined) {
			list.addSubnet(network, Number(prefix), isIP(network) === IPV4_FAMILY ? "ipv4" : "ipv6");
		}
	}
	return list;
}

const COMPILED_RANGES: readonly (readonly [Exclude<IpAddressScope, "PUBLIC">, BlockList])[] = SPECIAL_PURPOSE_RANGES.map(
	([scope, ranges]): readonly [Exclude<IpAddressScope, "PUBLIC">, BlockList] => [scope, compile(ranges)],
);

/** `fe80::1%eth0` → `fe80::1` (a zone index is meaningless off the host). */
function withoutZone(address: string): string {
	const zone: number = address.indexOf("%");
	return zone === -1 ? address : address.slice(0, zone);
}

/** Version and scope of `address`, or `null` when it is not an IP address. */
export function classifyIpAddress(address: string): IpClassification | null {
	const normalized: string = withoutZone(normalizeAddress(address));
	const family: number = isIP(normalized);
	if (family !== IPV4_FAMILY && family !== IPV6_FAMILY) {
		return null;
	}
	const version: IpVersion = family === IPV4_FAMILY ? IPV4_FAMILY : IPV6_FAMILY;
	const type = version === IPV4_FAMILY ? "ipv4" : "ipv6";
	const match = COMPILED_RANGES.find(([, list]): boolean => list.check(normalized, type));
	return { version, scope: match?.[LIST_SLOT_INDEX.first] ?? "PUBLIC" };
}
