import { networkInterfaces, type NetworkInterfaceInfo } from "node:os";

// ============================================
// config/api-public-url.ts — the address clients reach this API at
// ============================================
// Links the API hands out for files it serves itself (the local storage
// driver's downloads, uploads and public images) need an address the CLIENT
// can open. `HOST` is where the server listens: `0.0.0.0` / `::` mean "every
// network" — not an address anyone can visit (a phone resolves 0.0.0.0 to
// itself). So with such a wildcard and no `API_PUBLIC_URL`, development uses
// this machine's LAN address — the one a phone on the same Wi-Fi (Expo Go)
// already reaches the API at — and every other environment `localhost`.

/** Listen addresses that mean "every interface", never a reachable host. */
const WILDCARD_HOSTS: ReadonlySet<string> = new Set(["0.0.0.0", "::", "[::]"]);

/** Private IPv4 ranges (RFC 1918): a LAN address, as opposed to a public or link-local one. */
const PRIVATE_IPV4 = /^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/u;

/** Interface names of the machine's own wired / Wi-Fi network (macOS en*, Linux eth* / en* / wl*). */
const PHYSICAL_INTERFACE = /^(?:en|eth|wl)/u;

/** `os.networkInterfaces()`'s shape — injected so the choice is testable. */
export type NetworkInterfaceMap = Readonly<Record<string, readonly NetworkInterfaceInfo[] | undefined>>;

/**
 * This machine's LAN IPv4 address, or `null`: a private address on a physical
 * interface first (Wi-Fi / Ethernet), else any private address — never a
 * loopback, link-local or virtual-bridge-only choice when a real one exists.
 */
export function findLanAddress(interfaces: NetworkInterfaceMap): string | null {
	const candidates = Object.entries(interfaces).flatMap(([name, addresses]) =>
		(addresses ?? [])
			.filter((address) => address.family === "IPv4" && !address.internal && PRIVATE_IPV4.test(address.address))
			.map((address) => ({ name, address: address.address })),
	);
	const physical = candidates.find((candidate) => PHYSICAL_INTERFACE.test(candidate.name));
	return (physical ?? candidates.at(0))?.address ?? null;
}

export interface ApiPublicUrlInput {
	/** `API_PUBLIC_URL`, when set. */
	readonly configuredUrl?: string | undefined;
	/** `HOST`: where the server listens. */
	readonly host: string;
	/** `PORT`. */
	readonly port: number;
	readonly isDevelopment: boolean;
}

/**
 * The base URL clients reach this API at: `API_PUBLIC_URL` (without a trailing
 * slash) when set; else `HOST` when it is a real address; else — `HOST` is a
 * wildcard — this machine's LAN address in development, `localhost` otherwise.
 */
export function resolveApiPublicUrl(input: ApiPublicUrlInput, interfaces: NetworkInterfaceMap = networkInterfaces()): string {
	if (input.configuredUrl !== undefined) {
		return input.configuredUrl.replace(/\/+$/u, "");
	}
	const port = String(input.port);
	if (!WILDCARD_HOSTS.has(input.host)) {
		return `http://${input.host}:${port}`;
	}
	const lanAddress = input.isDevelopment ? findLanAddress(interfaces) : null;
	return `http://${lanAddress ?? "localhost"}:${port}`;
}
