// ============================================
// application/ports/dependency-probe.port.ts — checking one dependency
// ============================================
// Design patterns:
//   - STRATEGY: one probe per dependency (PostgreSQL, Redis, the queues, Kafka, RabbitMQ, the public
//     endpoints), each implementing this one interface; the collector runs them all the same way
//     (Open/Closed: a new dependency is a new probe, the collector does not change).

import type { OpsDependency, OpsDependencyStats } from "@workspace/shared";

/** One check's outcome. `configured: false` — the deployment does not use it (never an alert). */
export type DependencyProbeResult =
	| { readonly configured: false }
	| { readonly configured: true; readonly up: true; readonly latencyMs: number; readonly stats: OpsDependencyStats }
	| { readonly configured: true; readonly up: false; readonly latencyMs: number | null; readonly error: string };

export interface DependencyProbe {
	readonly dependency: OpsDependency;
	probe(): Promise<DependencyProbeResult>;
}

export const DEPENDENCY_PROBES = Symbol("DEPENDENCY_PROBES");
