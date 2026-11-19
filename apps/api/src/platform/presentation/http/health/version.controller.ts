import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	API_DEPRECATED_VERSIONS,
	API_VERSION,
	API_VERSION_PREFIX,
	API_VERSIONS,
	ApiVersionManifestSchema,
	apiDocsPath,
	type ApiVersion,
	type ApiVersionManifest,
} from "@workspace/shared";

import { ZodRawResponse } from "../validation/decorators/zod-response.decorators";
import { Public } from "../security/decorators/public.decorator";

/**
 * `GET /version` — machine-readable API version manifest. UNVERSIONED by
 * design: it is the thing clients use to FIND the current version during
 * negotiation (a client pinned to an old major hits a 404 and reads this to
 * learn the new prefix), so it must never move when a major bumps — like
 * `/health`, it lives at the root without `apiPath()`.
 *
 * Returns the current version, every served version (with the sunset date of a
 * deprecated one), and the docs/prefix locations so a client can switch its
 * pinned version without hardcoding anything.
 *
 * Sent RAW — no `{ success, data, meta }` envelope (`@ZodRawResponse`): its
 * consumer is the client transport's 404 negotiation (`loadVersionManifest`
 * in `packages/client`), which parses the body with `ApiVersionManifestSchema`.
 */
@ApiTags("System")
@Controller("version")
export class VersionController {
	@Public()
	@Get()
	@ApiOperation({ summary: "API version manifest (current, supported, docs)" })
	@ZodRawResponse(ApiVersionManifestSchema, { description: "Version negotiation manifest" })
	public getVersion(): ApiVersionManifest {
		return {
			current: API_VERSION,
			default: API_VERSION,
			supported: API_VERSIONS.map((version: ApiVersion) => {
				const deprecated = API_DEPRECATED_VERSIONS.find((entry) => entry.version === version);
				return deprecated === undefined ? { version } : { version, sunsetAt: deprecated.sunsetAt };
			}),
			docs: apiDocsPath(),
			prefix: API_VERSION_PREFIX,
		};
	}
}
