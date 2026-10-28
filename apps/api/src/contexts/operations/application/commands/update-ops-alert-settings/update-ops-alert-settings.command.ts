import { Command } from "@nestjs/cqrs";
import type { OpsAlertSettings } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `PUT /admin/operations/alert-settings` (SuperAdmin): the thresholds and the extra recipients. */
export class UpdateOpsAlertSettingsCommand extends Command<OpsAlertSettings> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly settings: OpsAlertSettings,
	) {
		super();
	}
}
