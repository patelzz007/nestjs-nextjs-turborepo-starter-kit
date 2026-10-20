import { Injectable } from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";

import { ActorContextSchema, type ActorContext } from "../../../../platform/application/actor-context";
import { generateCorrelationId } from "../../../../platform/infrastructure/context/correlation-id";
import { RequestContextService } from "../../../../platform/infrastructure/context/request-context";
import { AssignDefaultRoleCommand } from "../../application/commands/assign-default-role/assign-default-role.command";
import type { AccountDefaultRolePort } from "../../application/ports/default-role-assignment.port";

/**
 * The standalone default-role assignment other contexts call for an EXISTING account (merchant
 * onboarding of a known user). Signup and onboarding are anonymous requests, so the unit of work runs as
 * the request's anonymous actor; the account itself is the audited actor of the assignment.
 */
@Injectable()
export class AccountDefaultRoleAdapter implements AccountDefaultRolePort {
	public constructor(
		private readonly commandBus: CommandBus,
		private readonly requestContext: RequestContextService,
	) {}

	public async ensureDefaultRole(userId: string): Promise<void> {
		await this.commandBus.execute(new AssignDefaultRoleCommand(this.requestActor(), userId));
	}

	private requestActor(): ActorContext {
		const context = this.requestContext.current();
		return ActorContextSchema.parse({
			kind: "anonymous",
			tenantId: null,
			request: {
				requestId: this.requestContext.correlationId() ?? generateCorrelationId(),
				ip: context?.ip ?? null,
				userAgent: context?.userAgent ?? null,
				deviceLabel: null,
				endpoint: null,
			},
		});
	}
}
