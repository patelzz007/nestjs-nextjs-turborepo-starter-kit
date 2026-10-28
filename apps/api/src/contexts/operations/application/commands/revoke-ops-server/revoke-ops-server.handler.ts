import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { DeleteSuccessData } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { OpsServerNotFoundError } from "../../../domain/errors/operations.errors";
import type { OperationsScope } from "../../operations-scope";
import { OPS_SERVERS_WRITE_OPERATION, OPS_UNIT_OF_WORK } from "../../ports/operations.tokens";
import { actingUserIdOf } from "../../services/ops-server-view";
import { RevokeOpsServerCommand } from "./revoke-ops-server.command";

/** Soft-deletes the server: its history stays until retention removes it, its token is refused at once. */
@CommandHandler(RevokeOpsServerCommand)
export class RevokeOpsServerHandler implements ICommandHandler<RevokeOpsServerCommand, DeleteSuccessData> {
	public constructor(
		@Inject(OPS_UNIT_OF_WORK) private readonly uow: UnitOfWork<OperationsScope>,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute({ actor, serverId }: RevokeOpsServerCommand): Promise<DeleteSuccessData> {
		const userId: string = actingUserIdOf(actor);
		await this.uow.runSystemOperation(OPS_SERVERS_WRITE_OPERATION, actor, async (scope): Promise<void> => {
			if ((await scope.servers.find(serverId)) === null) {
				throw new OpsServerNotFoundError(serverId);
			}
			await scope.servers.revoke(serverId, this.clock.now(), userId);
		});
		return { success: true };
	}
}
