import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import { nanoid } from "nanoid";

import type { QueryLogEntry } from "@workspace/shared";

import { PrismaService } from "../../prisma/prisma.service.js";

import { modelFromSql } from "./n1-detector.js";
import { RequestSpanContext, type SpanStore } from "./request-span-context.js";
import { sanitizeQueryParams } from "./sanitize.js";
import { TELESCOPE_STORE } from "./telescope.options.js";
import type { TelescopeStore } from "./telescope.store.js";

/**
 * Structural shape of Prisma's `query` event. The generated client does NOT
 * expose query-event types under driver adapters (Prisma 7) — the callback
 * receives `{ timestamp, query, params, duration, target }` at runtime, and
 * `model`/`operation` are derived from the SQL prefix instead.
 */
interface PrismaQueryEventLike {
	readonly timestamp: Date;
	readonly query: string;
	readonly params: string;
	readonly duration: number;
}

/** The narrow `$on` surface we need — typed structurally at the library boundary. */
interface PrismaClientWithQueryEvents {
	$on(event: "query", callback: (event: PrismaQueryEventLike) => void): void;
}

const SQL_OPERATION_PATTERN = /^\s*(select|insert|update|delete|create|alter|drop|truncate)\b/i;

function operationFromSql(query: string): string {
	const match: RegExpMatchArray | null = SQL_OPERATION_PATTERN.exec(query);
	return match !== null ? match[1].toUpperCase() : "QUERY";
}

/**
 * Subscribes to Prisma's `query` event and funnels every operation into the
 * telescope store: a `QueryLogEntry` row plus a nested `prisma` span on the
 * current request's timeline (AsyncLocalStorage makes the association free —
 * the query event fires inside the request's async context).
 *
 * NOTE: Prisma 7 driver adapters may not emit `query` events (known
 * limitation — see docs/telescope.md §5.3). Capture degrades gracefully: no
 * events = no query rows, and nothing else is affected.
 */

@Injectable()
// eslint-disable-next-line @darraghor/nestjs-typed/injectable-should-be-provided -- Registered in TelescopeModule.register()'s dynamic providers; the typed plugin only scans static @Module decorators.
export class TelescopePrismaListener implements OnModuleInit {
	public constructor(
		private readonly prisma: PrismaService,
		@Inject(TELESCOPE_STORE) private readonly store: TelescopeStore,
	) {}

	public onModuleInit(): void {
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Library boundary: the generated client omits query-event types under driver adapters
		const client = this.prisma as PrismaClientWithQueryEvents;
		client.$on("query", (event: PrismaQueryEventLike): void => {
			const spanStore: SpanStore | undefined = RequestSpanContext.getStore();
			// Only queries that ran inside a CAPTURED request are recorded —
			// queries outside a request (or sampled out) are skipped entirely.
			if (spanStore?.captured !== true) {
				return;
			}
			const correlationId: string = spanStore.correlationId;
			// Prisma's query event reports float milliseconds (e.g. 17.697…); the
			// shared `QueryLogEntrySchema` requires `z.number().int()`, so round
			// at capture time or the client-side envelope validation rejects the row.
			const durationMs: number = Math.round(event.duration);
			// Feature 11 — query overlay: the query's offset from the request start
			// (same value as the span so the overlay lines up with the waterfall).
			const startOffsetMs: number = Math.max(0, Math.round(performance.now() - spanStore.startedAt) - durationMs);

			spanStore.spans.push({
				name: `${operationFromSql(event.query)} query`,
				kind: "prisma",
				startOffsetMs,
				durationMs,
			});

			const entry: QueryLogEntry = {
				id: nanoid(),
				correlationId,
				// Improvement 7: derive the model from SQL so the N+1 detector
				// can group queries by table (Prisma 7 driver adapters don't
				// report the model on the query event).
				model: modelFromSql(event.query),
				operation: operationFromSql(event.query),
				query: event.query,
				params: sanitizeQueryParams(event.params),
				durationMs,
				// Feature 11 — same offset as the span above.
				startOffsetMs,
				createdAt: new Date().toISOString(),
			};
			this.store.pushQuery(entry);
		});
	}
}
