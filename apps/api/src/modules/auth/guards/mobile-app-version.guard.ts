import { CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import { APP_VERSION_HEADER, AppVersionSchema, AuthClientTypeSchema, compareAppVersions, type AppVersion, type AuthClientType } from "@workspace/shared";
import type { FastifyRequest } from "fastify";

import { AppVersionUnsupportedError } from "../../../common/errors/app-error";
import { readFirstHeader } from "../../../common/utils/http-headers";
import { TypedConfigService } from "../../../config/typed-config.service";
import { resolveRequestClientType } from "../utils/client-type";

/** Why a mobile request's declared version was refused — logged nowhere, sent as `details.reason`. */
type AppVersionRejection = "missing" | "malformed" | "below_minimum";

/**
 * Forced upgrade for the mobile app (ADR 033) — a global guard, registered
 * FIRST so an outdated app is told to update (426) before anything else can
 * answer it (401, 403, 429 …), on every route: public ones such as login
 * included, because the oldest build must be stoppable at sign-in too.
 *
 * - Client type `mobile` (`resolveRequestClientType`): `X-App-Version` must be a
 *   semantic version (`AppVersionSchema`) at or above `MOBILE_MIN_SUPPORTED_VERSION`
 *   by semver precedence. Missing, malformed or lower → 426
 *   `APP_VERSION_UNSUPPORTED` in the standard error envelope, with
 *   `details.minimumVersion` so the update screen can name it. A prerelease
 *   ranks below its release (`1.0.0-beta.3` < `1.0.0`): a beta of the minimum
 *   is refused, a beta of a NEWER version is served. Build metadata is ignored.
 * - Browser client types are never checked: they always run the deployed build.
 *
 * Health probes are unaffected in practice: load balancers and monitors send
 * no `X-Client-Type`, so they resolve to a browser type.
 */
@Injectable()
export class MobileAppVersionGuard implements CanActivate {
	public constructor(private readonly config: TypedConfigService) {}

	public canActivate(context: ExecutionContext): boolean {
		const request: FastifyRequest = context.switchToHttp().getRequest<FastifyRequest>();
		const clientType: AuthClientType = resolveRequestClientType(request);
		if (clientType !== AuthClientTypeSchema.enum.mobile) {
			return true;
		}

		const minimumVersion: AppVersion = this.config.mobile.minSupportedVersion;
		const rejection: AppVersionRejection | undefined = MobileAppVersionGuard.rejectionOf(readFirstHeader(request.headers[APP_VERSION_HEADER.toLowerCase()]), minimumVersion);
		if (rejection !== undefined) {
			throw new AppVersionUnsupportedError({ details: { reason: rejection, minimumVersion } });
		}
		return true;
	}

	private static rejectionOf(declared: string | undefined, minimumVersion: AppVersion): AppVersionRejection | undefined {
		if (declared === undefined) {
			return "missing";
		}
		const version = AppVersionSchema.safeParse(declared);
		if (!version.success) {
			return "malformed";
		}
		return compareAppVersions(version.data, minimumVersion) < 0 ? "below_minimum" : undefined;
	}
}
