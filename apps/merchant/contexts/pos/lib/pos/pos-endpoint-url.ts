import { API_VERSION_PREFIX } from "@workspace/shared";

/** Absolute URL a till calls: the API origin (trailing slashes dropped) + version prefix + route (`apiRoutes.*`). */
export function posEndpointUrl(apiBaseUrl: string, path: string): string {
	return `${apiBaseUrl.replace(/\/+$/u, "")}${API_VERSION_PREFIX}${path}`;
}
