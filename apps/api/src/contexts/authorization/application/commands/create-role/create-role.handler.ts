import { Inject, Logger } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { RoleResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import { RoleAggregate, type RoleState } from "../../../domain/aggregates/role.aggregate";
import { RoleNameTakenError } from "../../../domain/errors/authorization.errors";
import type { AuthorizationScope } from "../../authorization-scope";
import { requireUserActor } from "../../services/rbac-actor";
import { RbacMutationScope, type RbacMutationOutcome } from "../../services/rbac-mutation-scope";
import { toRoleResponse } from "../../services/rbac-response.mapper";
import { CreateRoleCommand } from "./create-role.command";
import { newRowId } from "@workspace/shared";

@CommandHandler(CreateRoleCommand)
export class CreateRoleHandler implements ICommandHandler<CreateRoleCommand, RoleResponse> {
	private readonly logger: Logger = new Logger(CreateRoleHandler.name);

	public constructor(
		private readonly rbac: RbacMutationScope,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: CreateRoleCommand): Promise<RoleResponse> {
		const { input } = command;
		const actor = requireUserActor(command.actor);
		const created: RoleResponse = await this.rbac.run({ kind: "user", actor }, async (scope: AuthorizationScope): Promise<RbacMutationOutcome<RoleResponse>> => {
			if (await scope.roles.isNameTaken(input.name)) {
				throw new RoleNameTakenError(input.name, true);
			}
			const role: RoleAggregate = RoleAggregate.create({ id: newRowId(), name: input.name, description: input.description ?? null }, this.clock.now());
			const stored: RoleState = await scope.roles.save(role);
			return {
				kind: "changed",
				result: toRoleResponse(stored),
				audits: [{ action: "ROLE_CREATED", targetRoleId: stored.id, detail: JSON.stringify(input) }],
				affectedUserIds: [],
			};
		});
		this.logger.log(`Created role "${created.name}" (${created.id})`);
		return created;
	}
}
