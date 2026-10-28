import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { OpsServerCredentials } from "@workspace/shared";

import { TypedConfigService } from "../../../../../config/typed-config.service";
import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { OpsServerNameTakenError } from "../../../domain/errors/operations.errors";
import { issueAgentToken } from "../../../domain/policies/agent-token.policy";
import type { OperationsScope } from "../../operations-scope";
import { OPS_SERVERS_WRITE_OPERATION, OPS_UNIT_OF_WORK } from "../../ports/operations.tokens";
import { agentInstallCommand, toServerDetail } from "../../services/ops-server-view";
import { RegisterOpsServerCommand } from "./register-ops-server.command";

/**
 * Registers a server under a unique name and issues its agent token. The token is returned once,
 * here; only its digest is stored (Single Responsibility: issuing lives in the domain policy).
 */
@CommandHandler(RegisterOpsServerCommand)
export class RegisterOpsServerHandler implements ICommandHandler<RegisterOpsServerCommand, OpsServerCredentials> {
	public constructor(
		@Inject(OPS_UNIT_OF_WORK) private readonly uow: UnitOfWork<OperationsScope>,
		@Inject(CLOCK) private readonly clock: Clock,
		private readonly config: TypedConfigService,
	) {}

	public async execute({ actor, input }: RegisterOpsServerCommand): Promise<OpsServerCredentials> {
		const token = issueAgentToken();
		return this.uow.runSystemOperation(OPS_SERVERS_WRITE_OPERATION, actor, async (scope): Promise<OpsServerCredentials> => {
			if (await scope.servers.isNameTaken(input.name)) {
				throw new OpsServerNameTakenError(input.name);
			}
			const server = await scope.servers.create({
				name: input.name,
				provider: input.provider,
				providerServerId: input.providerServerId,
				tokenHash: token.hash,
				tokenPrefix: token.prefix,
			});
			const { alerts } = await scope.settings.get();
			return {
				server: toServerDetail(server, { live: null, openAlerts: 0, now: this.clock.now(), silentAfterMinutes: alerts.silentAfterMinutes, cloud: null, cloudError: null }),
				agentToken: token.token,
				installCommand: agentInstallCommand(this.config.http.publicUrl, token.token),
			};
		});
	}
}
