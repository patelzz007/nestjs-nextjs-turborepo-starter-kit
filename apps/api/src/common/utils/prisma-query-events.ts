import { PrismaQuerySubscriberSchema, type PrismaQueryEvent } from "@workspace/shared";

import type { PrismaService } from "../../prisma/prisma.service";

/** Subscribes to Prisma `query` events when the client exposes `$on` at runtime. */
export function subscribePrismaQueryEvents(prisma: PrismaService, callback: (event: PrismaQueryEvent) => void): void {
	if (!PrismaQuerySubscriberSchema.safeParse(prisma).success) {
		return;
	}
	const onFn = Reflect.get(prisma, "$on");
	if (!(onFn instanceof Function)) {
		return;
	}
	// Call on the real client — Prisma `$on` uses `this._engineConfig.logEmitter`.
	Reflect.apply(onFn, prisma, ["query", callback]);
}
