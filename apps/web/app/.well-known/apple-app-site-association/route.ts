// `GET /.well-known/apple-app-site-association` (ADR 080): an iPhone offers this site's passkeys to the iOS apps
// named here only (`webcredentials`). Served as JSON, with no file extension, as Apple fetches it.

import { associationFileResponse, passkeyAppAssociations } from "@/lib/passkeys/app-associations";

// Read from the API at request time: the apps are deployment configuration, not part of the build.
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
	const { appleAppSiteAssociation } = await passkeyAppAssociations();
	return associationFileResponse(appleAppSiteAssociation);
}
