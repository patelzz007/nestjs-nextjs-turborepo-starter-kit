import type { Prisma } from "@prisma/client";
import type { EpochMs } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { PrismaReadExecutor } from "../../../../platform/infrastructure/unit-of-work/prisma-read-executor";
import type { StatusIncidentRecord } from "../../application/ports/status-incident.repository.port";
import type { PublicStatusReads } from "../../application/ports/public-status-reads.port";
import { STATUS_PUBLIC_READ_OPERATION } from "../../application/ports/operations.tokens";
import { PrismaStatusIncidentRepository } from "./prisma-status-incident.repository";

export class PrismaPublicStatusReads implements PublicStatusReads {
	public constructor(private readonly executor: PrismaReadExecutor<Prisma.TransactionClient>) {}

	public incidents(actor: ActorContext, resolvedSince: EpochMs): Promise<readonly StatusIncidentRecord[]> {
		return this.executor.readAsSystemOperation(STATUS_PUBLIC_READ_OPERATION, actor, (db) => new PrismaStatusIncidentRepository(db, "public").forPublicPage(resolvedSince));
	}
}
