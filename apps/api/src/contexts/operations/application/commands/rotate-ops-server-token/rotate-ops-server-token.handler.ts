import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { OpsServerCredentials } from "@workspace/shared";

import { TypedConfigService } from "../../../../../config/typed-config.service";
import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { OpsServerNotFoundError } from "../../../domain/errors/operations.errors";
import { issueAgentToken } from "../../../domain/policies/agent-token.policy";
import type { OperationsScope } from "../../operations-scope";
import { OPS_SERVERS_WRITE_OPERATION, OPS_UNIT_OF_WORK } from "../../ports/operations.tokens";
import { agentInstallCommand, toServerDetail } from "../../services/ops-server-view";
import { RotateOpsServerTokenCommand } from "./rotate-ops-server-token.command";

/** Replaces a server's agent token. The agent must be restarted with the new one; until then it is refused. */
@CommandHandler(RotateOpsServerTokenCommand)
export class RotateOpsServerTokenHandler implements ICommandHandler<RotateOpsServerTokenCommand, OpsServerCredentials> {
	public constructor(
		@Inject(OPS_UNIT_OF_WORK) private readonly uow: UnitOfWork<OperationsScope>,
		@Inject(CLOCK) private readonly clock: Clock,
		private readonly config: TypedConfigService,
	) {}

	public async execute({ actor, serverId }: RotateOpsServerTokenCommand): Promise<OpsServerCredentials> {
		const token = issueAgentToken();
		return this.uow.runSystemOperation(OPS_SERVERS_WRITE_OPERATION, actor, async (scope): Promise<OpsServerCredentials> => {
			if ((await scope.servers.find(serverId)) === null) {
				throw new OpsServerNotFoundError(serverId);
			}
			const server = await scope.servers.replaceToken(serverId, { tokenHash: token.hash, tokenPrefix: token.prefix });
			const { alerts } = await scope.settings.get();
			return {
				server: toServerDetail(server, { live: null, openAlerts: 0, now: this.clock.now(), silentAfterMinutes: alerts.silentAfterMinutes, cloud: null, cloudError: null }),
				agentToken: token.token,
				installCommand: agentInstallCommand(this.config.http.publicUrl, token.token),
			};
		});
	}
}
