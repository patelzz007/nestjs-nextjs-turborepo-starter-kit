import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import { nanoid } from "nanoid";

import type { QueryLogEntry } from "@workspace/shared";

import { PrismaService } from "../../prisma/prisma.service.js";

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

const SQL_OPERATION_PATTERN: RegExp = /^\s*(select|insert|update|delete|create|alter|drop|truncate)\b/i;

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
			if (spanStore === undefined || !spanStore.captured) {
				return;
			}
			const correlationId: string = spanStore.correlationId;
			const durationMs: number = event.duration;

			spanStore.spans.push({
				name: `${operationFromSql(event.query)} query`,
				kind: "prisma",
				startOffsetMs: Math.max(0, Math.round(performance.now() - spanStore.startedAt) - durationMs),
				durationMs,
			});

			const entry: QueryLogEntry = {
				id: nanoid(),
				correlationId,
				model: "",
				operation: operationFromSql(event.query),
				query: event.query,
				params: sanitizeQueryParams(event.params),
				durationMs,
				createdAt: new Date().toISOString(),
			};
			this.store.pushQuery(entry);
		});
	}
}
