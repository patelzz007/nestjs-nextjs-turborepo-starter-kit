import { z } from "zod";

import type { EndpointAccess } from "./endpoint-access";
import { HttpMethodSchema, listEndpoints, type Endpoint, type OpenApiDocument } from "./openapi";
import { pageForTags } from "./pages";
import { endpointHeading, headingAnchor } from "./render";

/**
 * One row per API operation for the docs' endpoint explorer (`/endpoints`, a TanStack Table): what it is,
 * who may call it, and the reference section that documents it. Built at build time from the same inputs
 * as the generated reference pages, served as `/api-endpoints.json`, and parsed back with
 * {@link EndpointIndexSchema} in the browser.
 */

/** How a caller authenticates, from the controller decorators (the same order `accessLines` checks). */
export const EndpointAuthSchema = z.enum(["public", "session", "apiKey", "refreshToken", "unknown"]);
export type EndpointAuth = z.output<typeof EndpointAuthSchema>;

export const EndpointRowSchema = z
	.object({
		operationId: z.string().min(1),
		method: HttpMethodSchema,
		path: z.string().min(1),
		summary: z.string(),
		/** The reference page's title (its tag group), e.g. "Auth and sessions". */
		group: z.string().min(1),
		/** `/docs/technical/api-reference/<page>#<method-path>` */
		href: z.string().startsWith("/docs/"),
		auth: EndpointAuthSchema,
		superAdminOnly: z.boolean(),
		permissions: z.array(z.string()),
		rateLimits: z.array(z.string()),
		deprecated: z.boolean(),
	})
	.strict();
export type EndpointRow = z.output<typeof EndpointRowSchema>;

export const EndpointIndexSchema = z.array(EndpointRowSchema);

const REFERENCE_ROUTE = "/docs/technical/api-reference";

export function endpointAuth(access: EndpointAccess | undefined): EndpointAuth {
	if (access === undefined) return "unknown";
	if (access.merchantApiKey) return "apiKey";
	if (access.refreshToken) return "refreshToken";
	if (access.isPublic) return "public";
	return "session";
}

function endpointRow(endpoint: Endpoint, access: EndpointAccess | undefined): EndpointRow {
	const page = pageForTags(endpoint.operation.tags);
	if (page === undefined) {
		throw new Error(`No API reference page for tag(s) [${endpoint.operation.tags.join(", ")}] of ${endpoint.operation.operationId}.`);
	}
	return {
		operationId: endpoint.operation.operationId,
		method: endpoint.method,
		path: endpoint.path,
		summary: endpoint.operation.summary ?? "",
		group: page.title,
		href: `${REFERENCE_ROUTE}/${page.slug}#${headingAnchor(endpointHeading(endpoint))}`,
		auth: endpointAuth(access),
		superAdminOnly: access?.superAdminOnly ?? false,
		permissions: [...(access?.permissions ?? [])],
		rateLimits: [...(access?.throttles ?? [])],
		deprecated: endpoint.operation.deprecated ?? false,
	};
}

/** Every operation in the OpenAPI document, in its path order, with its access rules. */
export function buildEndpointIndex(document: OpenApiDocument, access: ReadonlyMap<string, EndpointAccess>): readonly EndpointRow[] {
	return listEndpoints(document).map((endpoint) => endpointRow(endpoint, access.get(endpoint.operation.operationId)));
}
