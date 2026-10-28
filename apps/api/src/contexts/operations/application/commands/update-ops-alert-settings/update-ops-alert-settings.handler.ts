import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { OpsAlertSettings } from "@workspace/shared";

import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { OperationsScope } from "../../operations-scope";
import { OPS_SETTINGS_WRITE_OPERATION, OPS_UNIT_OF_WORK } from "../../ports/operations.tokens";
import { UpdateOpsAlertSettingsCommand } from "./update-ops-alert-settings.command";

/** Saves the alert settings (recipients de-duplicated, case-insensitively); the next evaluation uses them. */
@CommandHandler(UpdateOpsAlertSettingsCommand)
export class UpdateOpsAlertSettingsHandler implements ICommandHandler<UpdateOpsAlertSettingsCommand, OpsAlertSettings> {
	public constructor(@Inject(OPS_UNIT_OF_WORK) private readonly uow: UnitOfWork<OperationsScope>) {}

	public async execute({ actor, settings }: UpdateOpsAlertSettingsCommand): Promise<OpsAlertSettings> {
		const extraRecipients: string[] = [...new Map(settings.extraRecipients.map((email): [string, string] => [email.toLowerCase(), email.toLowerCase()])).values()];
		const saved: OpsAlertSettings = { ...settings, extraRecipients };
		await this.uow.runSystemOperation(OPS_SETTINGS_WRITE_OPERATION, actor, (scope) => scope.settings.updateAlerts(saved));
		return saved;
	}
}
