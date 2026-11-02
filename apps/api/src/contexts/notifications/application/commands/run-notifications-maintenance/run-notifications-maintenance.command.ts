import { Command } from "@nestjs/cqrs";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** Cron: the minute-by-minute housekeeping (`minute`) or the daily retention (`daily`), ADR 070. */
export class RunNotificationsMaintenanceCommand extends Command<string> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: { readonly run: "minute" | "daily" },
	) {
		super();
	}
}
