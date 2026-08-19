import { PrismaQuerySubscriberSchema, type PrismaQueryEvent } from "@workspace/shared";

import type { PrismaService } from "../../prisma/prisma.service";

/** Subscribes to Prisma `query` events when the client exposes `$on` at runtime. */
export function subscribePrismaQueryEvents(prisma: PrismaService, callback: (event: PrismaQueryEvent) => void): void {
	const subscriber = PrismaQuerySubscriberSchema.safeParse(prisma);
	if (!subscriber.success) {
		return;
	}
	subscriber.data.$on("query", callback);
}
