// ============================================
// schemas/api/version.ts - Version manifest
// ============================================
// The machine-readable API version manifest served at `GET /version`
// (UNVERSIONED — it is the thing clients use to FIND the current version, so
// it must never move when a major bumps). The client transport consults it on
// a 404 from its pinned version ("deploy-any-or-die" negotiation) and the
// API returns it from `VersionController` as a RAW body (`@ZodRawResponse` —
// no envelope), because the client parses the body with this schema directly.
//
// `ApiVersionSchema` lives in `contracts/versioning.ts` (no workspace imports),
// so importing it here creates no cycle.

import { z } from "zod";

import { ApiVersionSchema } from "../../contracts/versioning";

export const ApiVersionManifestSchema = z
	.object({
		/** The version currently deployed. Clients pin to this on negotiation. */
		current: ApiVersionSchema,
		/** Alias for `current` (some clients read "default" — both agree). */
		default: ApiVersionSchema,
		/** Every version the server answers on, with sunset dates for deprecated ones. */
		supported: z.array(z.object({ version: ApiVersionSchema, sunsetAt: z.string().optional() })),
		/** Swagger UI location for the current version (`/v1/docs`). */
		docs: z.string(),
		/** Physical path prefix for the current version (`/api/v1`). */
		prefix: z.string(),
	})
	.meta({ description: "Sent RAW (no `{ success, data, meta }` envelope). Response schema: unknown keys are stripped, never rejected (ADR 022)." });

export type ApiVersionManifest = z.output<typeof ApiVersionManifestSchema>;
