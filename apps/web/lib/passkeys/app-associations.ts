import "server-only";

import type { PasskeyAppAssociations } from "@workspace/shared";

import { createWebServerCaller } from "@/lib/web-server-api";

/**
 * How long a phone or Google's and Apple's checkers may keep the files: an hour, so a newly configured app is
 * associated within the hour, while the API is not asked on every check.
 */
export const APP_ASSOCIATION_MAX_AGE_SECONDS = 3600;

/** The native apps allowed to use this site's passkeys (ADR 080), as the API's configuration states them. */
export async function passkeyAppAssociations(): Promise<PasskeyAppAssociations> {
	const { data } = await createWebServerCaller().auth.passkeyAppAssociations.query(undefined);
	return data;
}

/** One `/.well-known/` file: JSON, public, cacheable for the hour above. */
export function associationFileResponse(body: PasskeyAppAssociations[keyof PasskeyAppAssociations]): Response {
	return Response.json(body, { headers: { "Cache-Control": `public, max-age=${String(APP_ASSOCIATION_MAX_AGE_SECONDS)}` } });
}
