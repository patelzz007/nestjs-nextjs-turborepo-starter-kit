// ============================================
// application/commands/status-page/status-page.handlers.ts — open an incident, post an update (enhancement 4.5)
// ============================================

import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { StatusIncident } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { StatusIncidentNotFoundError, StatusIncidentResolvedError } from "../../../domain/errors/operations.errors";
import type { OperationsScope } from "../../operations-scope";
import { OPS_UNIT_OF_WORK, STATUS_WRITE_OPERATION } from "../../ports/operations.tokens";
import { actingUserIdOf } from "../../services/ops-server-view";
import { toStaffIncident } from "../../services/status-page.service";
import { OpenStatusIncidentCommand, PostStatusIncidentUpdateCommand } from "./status-page.commands";

@CommandHandler(OpenStatusIncidentCommand)
export class OpenStatusIncidentHandler implements ICommandHandler<OpenStatusIncidentCommand, StatusIncident> {
	public constructor(
		@Inject(OPS_UNIT_OF_WORK) private readonly uow: UnitOfWork<OperationsScope>,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute({ actor, input }: OpenStatusIncidentCommand): Promise<StatusIncident> {
		const openedById = actingUserIdOf(actor);
		const record = await this.uow.runSystemOperation(STATUS_WRITE_OPERATION, actor, (scope) =>
			scope.statusIncidents.open({ title: input.title, impact: input.impact, components: input.components, message: input.message, openedById, at: this.clock.now() }),
		);
		return toStaffIncident(record);
	}
}

@CommandHandler(PostStatusIncidentUpdateCommand)
export class PostStatusIncidentUpdateHandler implements ICommandHandler<PostStatusIncidentUpdateCommand, StatusIncident> {
	public constructor(
		@Inject(OPS_UNIT_OF_WORK) private readonly uow: UnitOfWork<OperationsScope>,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute({ actor, incidentId, input }: PostStatusIncidentUpdateCommand): Promise<StatusIncident> {
		const postedById = actingUserIdOf(actor);
		const record = await this.uow.runSystemOperation(STATUS_WRITE_OPERATION, actor, async (scope) => {
			const posted = await scope.statusIncidents.postUpdate(incidentId, { state: input.state, message: input.message, postedById, at: this.clock.now() });
			if (posted !== null) {
				return posted;
			}
			// Nothing moved: it's gone, or it was already resolved (perhaps by someone a moment ago).
			if ((await scope.statusIncidents.find(incidentId)) === null) {
				throw new StatusIncidentNotFoundError(incidentId);
			}
			throw new StatusIncidentResolvedError(incidentId);
		});
		return toStaffIncident(record);
	}
}
