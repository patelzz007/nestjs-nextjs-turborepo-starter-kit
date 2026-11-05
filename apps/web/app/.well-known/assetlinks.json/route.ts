// `GET /.well-known/assetlinks.json` (ADR 080): Android's Digital Asset Links. A phone offers this site's passkeys
// to the Android app named here only, and only because this file, on the passkeys' own domain, says so.

import { associationFileResponse, passkeyAppAssociations } from "@/lib/passkeys/app-associations";

// Read from the API at request time: the apps are deployment configuration, not part of the build.
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
	const { assetLinks } = await passkeyAppAssociations();
	return associationFileResponse(assetLinks);
}
