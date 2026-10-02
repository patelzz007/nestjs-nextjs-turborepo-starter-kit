import { z } from "zod";

import { EpochMsSchema } from "./common";

// Response schemas of the infra probes (`GET /health*`). Like every response
// schema they strip unknown keys instead of rejecting them (ADR 022).

/** Legacy `GET /health` payload (deprecated alias — prefer `/health/live` and `/health/ready`). */
export const HealthResponseSchema = z.object({
	status: z.string(),
	db: z.string(),
	timestamp: EpochMsSchema,
});

// --- Inferred TypeScript types ---
export type HealthResponse = z.output<typeof HealthResponseSchema>;

/** Outcome of one readiness probe. */
export const HealthProbeStatusSchema = z.enum(["up", "down"]);

export type HealthProbeStatus = z.output<typeof HealthProbeStatusSchema>;

/** `GET /health/live` — the process is running and the event loop answers. */
export const LivenessResponseSchema = z.object({
	status: z.literal("ok"),
	uptimeSeconds: z.number().nonnegative().meta({ description: "Seconds since the Node.js process started", example: 3600 }),
	timestamp: EpochMsSchema,
});

export type LivenessResponse = z.output<typeof LivenessResponseSchema>;

/** One dependency checked by `GET /health/ready`. */
export const ReadinessCheckSchema = z.object({
	name: z.string().meta({ description: "Probe name (startup, database, or a module indicator)", example: "database" }),
	status: HealthProbeStatusSchema,
	critical: z.boolean().meta({ description: "Whether a failing probe makes the API not-ready (HTTP 503)" }),
});

export type ReadinessCheck = z.output<typeof ReadinessCheckSchema>;

/** `GET /health/ready` body when the API can serve traffic (HTTP 200). */
export const ReadinessResponseSchema = z.object({
	status: z.literal("ready"),
	checks: z.array(ReadinessCheckSchema),
	timestamp: EpochMsSchema,
});

export type ReadinessResponse = z.output<typeof ReadinessResponseSchema>;

/** One scalar of a module health report (JSON-safe: a `bigint` counter is sent as a number). */
export const ModuleHealthDetailValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export type ModuleHealthDetailValue = z.output<typeof ModuleHealthDetailValueSchema>;

/** One module indicator in `GET /health/deep`. */
export const ModuleHealthSchema = z.object({
	name: z.string(),
	healthy: z.boolean(),
	details: z.record(z.string(), ModuleHealthDetailValueSchema),
});

export type ModuleHealth = z.output<typeof ModuleHealthSchema>;

/** `GET /health/deep` payload — the legacy health shape plus filesystem, external checks and per-module reports. */
export const DeepHealthResponseSchema = HealthResponseSchema.extend({
	filesystem: z.string(),
	checks: z.record(z.string(), z.string()),
	modules: z.array(ModuleHealthSchema),
});

export type DeepHealthResponse = z.output<typeof DeepHealthResponseSchema>;
