// ============================================
// schemas/api/version.ts - Version manifest
// ============================================
// The machine-readable API version manifest served at `GET /version`
// (UNVERSIONED — it is the thing clients use to FIND the current version, so
// it must never move when a major bumps). The client transport consults it on
// a 404 from its pinned version ("deploy-any-or-die" negotiation) and the
// API returns it from `VersionController`.
//
// The `ApiVersion` type lives in `contracts/versioning.ts` (zero imports).
// This file imports only the type (no runtime dep on contracts), so no cycle.

import { z } from "zod";

import { type ApiVersion } from "../../contracts/versioning";

/** Zod enum derived from the single `ApiVersion` type source in `contracts/versioning`. */
const ApiVersionEnum: z.ZodType<ApiVersion> = z.enum(["v1", "v2"]);

export const ApiVersionManifestSchema = z
	.object({
		/** The version currently deployed. Clients pin to this on negotiation. */
		current: ApiVersionEnum,
		/** Alias for `current` (some clients read "default" — both agree). */
		default: ApiVersionEnum,
		/** Every version the server answers on, with sunset dates for deprecated ones. */
		supported: z.array(z.object({ version: ApiVersionEnum, sunsetAt: z.string().optional() })),
		/** Swagger UI location for the current version (`/v1/docs`). */
		docs: z.string(),
		/** Physical path prefix for the current version (`/api/v1`). */
		prefix: z.string(),
	})
	.strict();

export type ApiVersionManifest = z.output<typeof ApiVersionManifestSchema>;
