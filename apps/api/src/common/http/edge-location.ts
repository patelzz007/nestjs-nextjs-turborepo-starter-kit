// ============================================
// common/http/edge-location.ts — the client's location as the CDN edge saw it
// ============================================
// An IP address alone says nothing about geography without a GeoIP database
// (a third-party data set this project does not ship). CDNs, however, geo-locate
// every viewer at the edge and forward the result as request headers. This
// reads them — CloudFront, Cloudflare and Vercel, in that order — and nothing
// else.
//
// Trust: these headers are only meaningful when a CDN set them. The caller
// (RequestContextMiddleware) reads them ONLY when the TCP peer is a configured
// trusted proxy (`TRUST_PROXY`); a direct client cannot inject a location.
// The edge must overwrite these headers (CloudFront, Cloudflare and Vercel do).

import type { IncomingHttpHeaders } from "node:http";

import { IanaTimeZoneSchema } from "@workspace/shared";
import { z } from "zod";

import { readFirstHeader } from "../utils/http-headers";

/** Where the CDN edge located the client. Absent fields were not provided. */
export interface RequestEdgeLocation {
	/** ISO 3166-1 alpha-2 (`MY`), or Cloudflare's `T1` for Tor exit nodes. */
	readonly country: string | undefined;
	readonly region: string | undefined;
	readonly city: string | undefined;
	/** IANA time zone (`Asia/Kuala_Lumpur`). */
	readonly timeZone: string | undefined;
}

/** Column budgets (prisma/schema.prisma `AuditLog.geo*`). */
const REGION_MAX_LENGTH = 64;
const CITY_MAX_LENGTH = 128;

/** Two letters/digits; Cloudflare's `XX` means "unknown" and is dropped. */
const UNKNOWN_COUNTRY = "XX";
const CountryCodeSchema = z
	.string()
	.trim()
	.toUpperCase()
	.regex(/^[A-Z0-9]{2}$/)
	.refine((code: string): boolean => code !== UNKNOWN_COUNTRY);

/** The geo headers of one CDN. */
interface EdgeGeoHeaders {
	readonly country: string;
	/** Preferred first (a readable name before a code). */
	readonly region: readonly string[];
	readonly city: string;
	readonly timeZone: string;
}

const EDGE_PROVIDERS: readonly EdgeGeoHeaders[] = [
	{
		country: "cloudfront-viewer-country",
		region: ["cloudfront-viewer-country-region-name", "cloudfront-viewer-country-region"],
		city: "cloudfront-viewer-city",
		timeZone: "cloudfront-viewer-time-zone",
	},
	{ country: "cf-ipcountry", region: ["cf-region", "cf-region-code"], city: "cf-ipcity", timeZone: "cf-timezone" },
	{ country: "x-vercel-ip-country", region: ["x-vercel-ip-country-region"], city: "x-vercel-ip-city", timeZone: "x-vercel-ip-timezone" },
];

/** Header values may be percent-encoded (Vercel encodes the city). */
function decoded(value: string | undefined, maxLength: number): string | undefined {
	if (value === undefined) {
		return undefined;
	}
	let text: string = value;
	try {
		text = decodeURIComponent(value);
	} catch {
		// Not percent-encoded (or malformed): keep the raw text.
	}
	const trimmed: string = text.trim();
	return trimmed.length === 0 ? undefined : trimmed.slice(0, maxLength);
}

function fromProvider(headers: IncomingHttpHeaders, provider: EdgeGeoHeaders): RequestEdgeLocation | undefined {
	const read = (name: string): string | undefined => readFirstHeader(headers[name]);
	const country = CountryCodeSchema.safeParse(read(provider.country));
	const region: string | undefined = provider.region.map((name: string): string | undefined => decoded(read(name), REGION_MAX_LENGTH)).find((value) => value !== undefined);
	const city: string | undefined = decoded(read(provider.city), CITY_MAX_LENGTH);
	const timeZone = IanaTimeZoneSchema.safeParse(read(provider.timeZone));
	const location: RequestEdgeLocation = {
		country: country.success ? country.data : undefined,
		region,
		city,
		timeZone: timeZone.success ? timeZone.data : undefined,
	};
	const hasAny: boolean = Object.values(location).some((value) => value !== undefined);
	return hasAny ? location : undefined;
}

/** The first CDN's geo headers present on the request, or `undefined` when none are. */
export function readEdgeLocation(headers: IncomingHttpHeaders): RequestEdgeLocation | undefined {
	for (const provider of EDGE_PROVIDERS) {
		const location: RequestEdgeLocation | undefined = fromProvider(headers, provider);
		if (location !== undefined) {
			return location;
		}
	}
	return undefined;
}
