// ============================================
// infrastructure/persistence/prisma-operations.reads.ts — `OperationsReads` on the read executor
// ============================================

import type { Prisma } from "@prisma/client";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { PrismaReadExecutor } from "../../../../platform/infrastructure/unit-of-work/prisma-read-executor";
import type { OperationsReadScope } from "../../application/operations-scope";
import type { OperationsReads } from "../../application/ports/operations-reads.port";
import { OPS_CONSOLE_READ_OPERATION } from "../../application/ports/operations.tokens";
import { createOperationsReadScope } from "./operations-scope.factory";

export class PrismaOperationsReads implements OperationsReads {
	public constructor(private readonly executor: PrismaReadExecutor<Prisma.TransactionClient>) {}

	public read<TResult>(actor: ActorContext, work: (scope: OperationsReadScope) => Promise<TResult>): Promise<TResult> {
		return this.executor.readAsSystemOperation(OPS_CONSOLE_READ_OPERATION, actor, (db) => work(createOperationsReadScope(db)));
	}
}
