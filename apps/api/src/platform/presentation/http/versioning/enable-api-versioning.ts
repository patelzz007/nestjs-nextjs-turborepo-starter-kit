import { VersioningType, type INestApplication } from "@nestjs/common";
import { API_URI_VERSION_PREFIX } from "@workspace/shared";

/**
 * Serves every `@ApiController` route at its versions' literal paths (`/api/v1/…`, `/api/v2/…`), the version
 * between `api/` and the controller path. A controller without versions (health, the version manifest, the email
 * webhook) keeps its own path. Call it on every app that mounts business controllers, before `init()`.
 */
export function enableApiVersioning(app: INestApplication): void {
	app.enableVersioning({ type: VersioningType.URI, prefix: API_URI_VERSION_PREFIX });
}
