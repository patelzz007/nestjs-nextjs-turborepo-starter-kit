import type { Prisma } from "@prisma/client";
import { z } from "zod";

import type { ScopeFactory } from "../../../../platform/application/events/in-transaction-event-handler";
import type { BroadcastImageUses, BroadcastImageUseScope } from "../../application/ports/broadcast-image-uses.port";

const CountRowSchema = z.object({ uses: z.number().int() });

/**
 * Broadcasts whose body names a picture, by Postgres' own JSON path query over the stored document (any depth:
 * a list item or a quote can hold an image), never by matching text.
 */
export class PrismaBroadcastImageUses implements BroadcastImageUses {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async countLiveUses(fileId: string): Promise<number> {
		const rows = await this.db.$queryRaw`
			SELECT count(*)::int AS uses FROM public."Broadcast" b
			 WHERE b."isDeleted" = false
			   AND jsonb_path_exists(b.body, '$.** ? (@.type == "image" && @.attrs.fileId == $id)', jsonb_build_object('id', ${fileId}::text))`;
		return z.array(CountRowSchema).parse(rows).at(0)?.uses ?? 0;
	}
}

export class BroadcastImageUseScopeFactory implements ScopeFactory<BroadcastImageUseScope, Prisma.TransactionClient> {
	public create(db: Prisma.TransactionClient): BroadcastImageUseScope {
		return { broadcastImageUses: new PrismaBroadcastImageUses(db) };
	}
}
