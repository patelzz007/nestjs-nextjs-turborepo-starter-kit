import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { API_DEPRECATED_VERSIONS, API_VERSION, API_VERSION_PREFIX, apiDocsPath, apiVersionPrefix, type ApiVersion } from "@workspace/shared";

import { Public } from "../auth/decorators/public.decorator";

interface VersionManifestEntry {
	readonly version: ApiVersion;
	readonly sunsetAt?: string;
}

interface VersionManifest {
	readonly current: ApiVersion;
	readonly default: ApiVersion;
	readonly supported: readonly VersionManifestEntry[];
	readonly docs: string;
	readonly prefix: string;
}

/**
 * `GET /version` — machine-readable API version manifest. UNVERSIONED by
 * design: it is the thing clients use to FIND the current version during
 * negotiation (a client pinned to an old major hits a 404 and reads this to
 * learn the new prefix), so it must never move when a major bumps — like
 * `/health`, it lives at the root without `apiPath()`.
 *
 * Returns the current version, the full supported list (with sunset dates for
 * deprecated ones), and the docs/prefix locations so a client can switch its
 * pinned version without hardcoding anything.
 */
@ApiTags("System")
@Controller("version")
export class VersionController {
	@Public()
	@Get()
	@ApiOperation({ summary: "API version manifest (current, supported, docs)" })
	@ApiOkResponse({ description: "Version negotiation manifest" })
	public getVersion(): VersionManifest {
		return {
			current: API_VERSION,
			default: API_VERSION,
			supported: [{ version: API_VERSION }, ...API_DEPRECATED_VERSIONS.map((entry) => ({ version: entry.version, sunsetAt: entry.sunsetAt }))],
			docs: apiDocsPath(),
			prefix: API_VERSION_PREFIX,
		};
	}

	/**
	 * Build a supported-version lookup used by the Accept-version rewrite.
	 * Kept as a static helper so main.ts can resolve `Accept-version` against
	 * the same list without instantiating the controller.
	 */
	public static isSupportedVersion(version: string): version is ApiVersion {
		return version === API_VERSION || API_DEPRECATED_VERSIONS.some((entry) => entry.version === version);
	}

	public static toApiVersion(headerValue: string): ApiVersion | undefined {
		const candidate: string = headerValue.startsWith("v") ? headerValue : `v${headerValue}`;
		return VersionController.isSupportedVersion(candidate) ? candidate : undefined;
	}

	public static prefixFor(version: ApiVersion): string {
		return apiVersionPrefix(version);
	}
}
