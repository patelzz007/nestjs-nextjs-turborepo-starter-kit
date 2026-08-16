// ============================================
// schemas/api/version.ts - Version manifest
// ============================================
// The machine-readable API version manifest served at `GET /version`
// (UNVERSIONED — it is the thing clients use to FIND the current version, so
// it must never move when a major bumps). The client transport consults it on
// a 404 from its pinned version ("deploy-any-or-die" negotiation) and the
// API returns it from `VersionController`.
//
// The version enum mirrors `ApiVersion` in `contracts/index.ts`. Keep the two
// in sync when adding a major (`"v3"` etc.) — the schema is deliberately
// self-contained so `contracts` (which imports `schemas`) never sees a cycle.

import { z } from "zod";

/** `"v1" | "v2" | …` — must mirror `ApiVersion` in `contracts/index.ts`. */
const ApiVersionEnum = z.enum(["v1", "v2"]);

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
