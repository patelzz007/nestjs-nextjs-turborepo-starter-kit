import { Global, Module } from "@nestjs/common";

import { LogService } from "./logs.service";
import { MemoryMonitorService } from "./memory/memory-monitor.service";
import { NodePostGcHeapProbe, POST_GC_HEAP_PROBE, type PostGcHeapProbe } from "./memory/post-gc-heap-probe";

/**
 * Application-wide structured logging.
 *
 * `@Global()` so any module can inject `LogService` without declaring it as a
 * provider or importing this module — it only needs to be imported once in the
 * root `AppModule`. Cross-cutting infrastructure services (like the
 * `@Global()` ConfigModule) follow the same pattern; before this module
 * existed, every consumer had to remember to add `LogService` to its own
 * `providers`/`exports`, which produced duplicate registrations and module
 * coupling just to reach a logger.
 */
@Global()
@Module({
	// MemoryMonitorService: post-GC heap leak detection (MEMORY_MONITORING;
	// always on in production) — not exported, nothing else depends on it.
	providers: [LogService, MemoryMonitorService, { provide: POST_GC_HEAP_PROBE, useFactory: (): PostGcHeapProbe => new NodePostGcHeapProbe() }],
	exports: [LogService],
})
export class LogsModule {}
