import { Injectable } from "@nestjs/common";

import { TypedConfigService } from "./typed-config.service";

/**
 * Turns a stored public reference into the URL a client opens. Stored as:
 * - an absolute URL — a CDN / bucket URL (S3 + CloudFront, Firebase), served as is;
 * - a path on this API (`/api/v1/files/…/local-public`, the local driver) — joined to
 *   the API's public address NOW, so a changed address (another Wi-Fi, a tunnel,
 *   `API_PUBLIC_URL`) never strands a picture saved earlier.
 */
export type PublicUrlResolve = (stored: string | null) => string | null;

/** {@link PublicUrlResolve} against a given base URL (no trailing slash). */
export function resolveStoredPublicUrl(stored: string | null, baseUrl: string): string | null {
	if (stored === null) {
		return null;
	}
	return stored.startsWith("/") ? `${baseUrl}${stored}` : stored;
}

/** {@link PublicUrlResolve} against the API's configured public address (`config.http.publicUrl`). */
@Injectable()
export class PublicUrlResolver {
	public constructor(private readonly config: TypedConfigService) {}

	public readonly resolve: PublicUrlResolve = (stored: string | null): string | null => resolveStoredPublicUrl(stored, this.config.http.publicUrl);
}
