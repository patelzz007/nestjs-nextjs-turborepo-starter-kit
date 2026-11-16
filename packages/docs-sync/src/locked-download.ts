import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

import type { DownloadedAsset } from "./source.ts";

/**
 * The only way a remote file enters the repository (plan §6, "Assets"). A document's author chooses the address,
 * so nothing about it is trusted: HTTPS only, allowed hosts only, every redirect hop checked, private addresses
 * refused so a page cannot make the sync read an internal service (SSRF), a size cap and a timeout, and the bytes
 * must really be the image the server says they are. SVG is refused: it can carry script.
 */

export const MAX_ASSET_BYTES = 20 * 1024 * 1024;
export const ASSET_TIMEOUT_MS = 30_000;
const MAX_REDIRECTS = 3;
const HTTPS_PROTOCOL = "https:";
const REDIRECT_MIN_STATUS = 300;
const REDIRECT_MAX_STATUS = 399;

/** A file the downloader refused. The message is written for the page's author. */
export class AssetRefusedError extends Error {
	public constructor(reason: string) {
		super(reason);
		this.name = "AssetRefusedError";
	}
}

/** The private, loopback and link-local ranges an address must not fall in. */
function privateAddresses(): BlockList {
	const list = new BlockList();
	list.addSubnet("0.0.0.0", 8, "ipv4");
	list.addSubnet("10.0.0.0", 8, "ipv4");
	list.addSubnet("100.64.0.0", 10, "ipv4");
	list.addSubnet("127.0.0.0", 8, "ipv4");
	list.addSubnet("169.254.0.0", 16, "ipv4");
	list.addSubnet("172.16.0.0", 12, "ipv4");
	list.addSubnet("192.168.0.0", 16, "ipv4");
	list.addAddress("::1", "ipv6");
	list.addSubnet("fc00::", 7, "ipv6");
	list.addSubnet("fe80::", 10, "ipv6");
	return list;
}

const PRIVATE_ADDRESSES = privateAddresses();

/** What a file's first bytes must be, for each image type accepted. */
interface ImageSignature {
	readonly contentType: string;
	readonly extension: string;
	readonly matches: (bytes: Uint8Array) => boolean;
}

function startsWith(bytes: Uint8Array, expected: readonly number[], offset = 0): boolean {
	return expected.every((byte, index) => bytes.at(offset + index) === byte);
}

const RIFF_MAGIC: readonly number[] = [0x52, 0x49, 0x46, 0x46];
const WEBP_MAGIC: readonly number[] = [0x57, 0x45, 0x42, 0x50];
const WEBP_MAGIC_OFFSET = 8;
const FTYP_MAGIC: readonly number[] = [0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66];
const FTYP_MAGIC_OFFSET = 4;

const IMAGE_SIGNATURES: readonly ImageSignature[] = [
	{ contentType: "image/png", extension: "png", matches: (bytes) => startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
	{ contentType: "image/jpeg", extension: "jpg", matches: (bytes) => startsWith(bytes, [0xff, 0xd8, 0xff]) },
	{ contentType: "image/gif", extension: "gif", matches: (bytes) => startsWith(bytes, [0x47, 0x49, 0x46, 0x38]) },
	{ contentType: "image/webp", extension: "webp", matches: (bytes) => startsWith(bytes, RIFF_MAGIC) && startsWith(bytes, WEBP_MAGIC, WEBP_MAGIC_OFFSET) },
	{ contentType: "image/avif", extension: "avif", matches: (bytes) => startsWith(bytes, FTYP_MAGIC, FTYP_MAGIC_OFFSET) },
];

/** The part of `fetch` this package uses. */
export type HttpFetch = (url: string | URL, init?: RequestInit) => Promise<Response>;

/** What the downloader needs from the outside world, so its refusals are tested without a network. */
export interface DownloadEnvironment {
	readonly fetch: HttpFetch;
	/** Every address a host name resolves to. */
	readonly resolveHost: (host: string) => Promise<readonly string[]>;
}

export const LIVE_DOWNLOAD_ENVIRONMENT: DownloadEnvironment = {
	fetch: (input, init) => globalThis.fetch(input, init),
	resolveHost: async (host: string): Promise<readonly string[]> => {
		const addresses = await lookup(host, { all: true });
		return addresses.map((entry) => entry.address);
	},
};

function isPrivate(address: string): boolean {
	return PRIVATE_ADDRESSES.check(address, isIP(address) === IPV6_FAMILY ? "ipv6" : "ipv4");
}

const IPV6_FAMILY = 6;

async function assertAllowed(url: URL, allowedHosts: ReadonlySet<string>, environment: DownloadEnvironment): Promise<void> {
	if (url.protocol !== HTTPS_PROTOCOL) {
		throw new AssetRefusedError(`Only HTTPS files can be downloaded, not ${url.protocol}`);
	}
	if (!allowedHosts.has(url.hostname)) {
		throw new AssetRefusedError(`Files can only come from the writing tool's own hosts, not ${url.hostname}`);
	}
	const addresses = await environment.resolveHost(url.hostname);
	if (addresses.length === 0 || addresses.some(isPrivate)) {
		throw new AssetRefusedError(`${url.hostname} resolves to a private address`);
	}
}

/** Reads a body up to the cap, stopping as soon as it is exceeded. */
async function readCapped(response: Response): Promise<Uint8Array> {
	const chunks: Uint8Array[] = [];
	let total = 0;
	if (response.body === null) {
		throw new AssetRefusedError("The file was empty");
	}
	for await (const chunk of response.body) {
		total += chunk.length;
		if (total > MAX_ASSET_BYTES) {
			throw new AssetRefusedError(`The file is larger than the ${String(MAX_ASSET_BYTES)} byte limit`);
		}
		chunks.push(chunk);
	}
	return Buffer.concat(chunks);
}

function contentTypeOf(response: Response): string {
	const [type = ""] = (response.headers.get("content-type") ?? "").split(";");
	return type.trim().toLowerCase();
}

/** Downloads one image under every rule above. */
export async function downloadImage(address: string, allowedHosts: ReadonlySet<string>, environment: DownloadEnvironment): Promise<DownloadedAsset> {
	let url = new URL(address);
	for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
		await assertAllowed(url, allowedHosts, environment);
		const response = await environment.fetch(url, { redirect: "manual", signal: AbortSignal.timeout(ASSET_TIMEOUT_MS) });
		if (response.status >= REDIRECT_MIN_STATUS && response.status <= REDIRECT_MAX_STATUS) {
			const location = response.headers.get("location");
			if (location === null) {
				throw new AssetRefusedError("The file's host answered with a redirect to nowhere");
			}
			url = new URL(location, url);
			continue;
		}
		if (!response.ok) {
			throw new AssetRefusedError(`The file's host answered ${String(response.status)}`);
		}
		const contentType = contentTypeOf(response);
		const signature = IMAGE_SIGNATURES.find((candidate) => candidate.contentType === contentType);
		if (signature === undefined) {
			throw new AssetRefusedError(`Files of type "${contentType}" are not accepted as images`);
		}
		const bytes = await readCapped(response);
		if (!signature.matches(bytes)) {
			throw new AssetRefusedError(`The file says it is ${contentType}, but its contents are not`);
		}
		return { bytes, extension: signature.extension };
	}
	throw new AssetRefusedError(`The file redirected more than ${String(MAX_REDIRECTS)} times`);
}
