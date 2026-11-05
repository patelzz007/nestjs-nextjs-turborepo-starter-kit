import { Processor, WorkerHost } from "@nestjs/bullmq";
import { MONITORED_WORKER_OPTIONS } from "@workspace/messaging/nest";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { QUEUE_NAMES } from "@workspace/shared";
import type { Job } from "bullmq";

import { systemActor } from "../../../../platform/application/actor-context";
import { SystemCommandDispatcher } from "../../../../platform/application/system-command-dispatcher";
import { SendBroadcastCommand } from "../../application/commands/send-broadcast/send-broadcast.command";
import { StartDueBroadcastsCommand } from "../../application/commands/start-due-broadcasts/start-due-broadcasts.command";
import { BROADCASTS_SEND_OPERATION } from "../../application/services/broadcast-service";
import { BroadcastSendJobSchema } from "../../application/ports/notification-queues.port";

/** `broadcasts.send` worker: one broadcast → its frozen audience's notifications, as an audited system command. */
@Processor(QUEUE_NAMES.broadcastsSend, MONITORED_WORKER_OPTIONS)
@Injectable()
export class BroadcastSendProcessor extends WorkerHost {
	public constructor(private readonly commands: SystemCommandDispatcher) {
		super();
	}

	public async process(job: Pick<Job, "data">): Promise<void> {
		const { broadcastId } = BroadcastSendJobSchema.parse(job.data);
		await this.commands.dispatch(new SendBroadcastCommand(systemActor(BROADCASTS_SEND_OPERATION, "job", null, "Send one broadcast", null), { broadcastId }), {
			kind: "job",
			name: QUEUE_NAMES.broadcastsSend,
		});
	}
}

/** Every minute, on every replica: due broadcasts go to the sending queue (a broadcast starts once: its move to SENDING is conditional). */
@Injectable()
export class BroadcastSchedulerCron {
	private readonly logger: Logger = new Logger(BroadcastSchedulerCron.name);

	public constructor(@Inject(SystemCommandDispatcher) private readonly dispatcher: Pick<SystemCommandDispatcher, "dispatch">) {}

	@Cron(CronExpression.EVERY_MINUTE)
	public async everyMinute(): Promise<void> {
		const started = await this.dispatcher.dispatch(new StartDueBroadcastsCommand(systemActor(BROADCASTS_SEND_OPERATION, "cron", null, "Start due broadcasts", null)), {
			kind: "cron",
			name: "BroadcastSchedulerCron.everyMinute",
		});
		if (started > 0) {
			this.logger.log({ event: "broadcasts.started", started });
		}
	}
}
