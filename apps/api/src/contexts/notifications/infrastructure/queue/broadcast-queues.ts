// ============================================
// notifications/infrastructure/queue/broadcast-queues.ts — handing a broadcast to its sender (ADR 073)
// ============================================

import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { QUEUE_JOB_OPTIONS, QUEUE_NAMES } from "@workspace/shared";
import { Queue } from "bullmq";

import { BroadcastSendJobSchema, type BroadcastSendJob } from "../../application/ports/notification-queues.port";
import type { BroadcastQueue } from "../../application/services/broadcast-service";

/** BullMQ: jobId = the broadcast, so the minute scheduler handing it off twice starts it once. */
@Injectable()
export class BullMqBroadcastQueue implements BroadcastQueue {
	public constructor(@InjectQueue(QUEUE_NAMES.broadcastsSend) private readonly queue: Queue<BroadcastSendJob>) {}

	public async start(broadcastId: string): Promise<void> {
		await this.queue.add("send", BroadcastSendJobSchema.parse({ broadcastId }), { ...QUEUE_JOB_OPTIONS.broadcastsSend, jobId: broadcastId });
	}
}

/** Without Redis: sent in this process right away; a failure is logged and the next minute's run retries it. */
export class InlineBroadcastQueue implements BroadcastQueue {
	private readonly logger: Logger = new Logger("InlineBroadcastQueue");
	private send: ((broadcastId: string) => Promise<void>) | null = null;

	/** Wired after construction: the service itself depends on this queue. */
	public bind(send: (broadcastId: string) => Promise<void>): void {
		this.send = send;
	}

	public start(broadcastId: string): Promise<void> {
		const send = this.send;
		setImmediate((): void => {
			send?.(broadcastId).catch((error: unknown): void => {
				this.logger.warn(`broadcasts.inline_send_failed id=${broadcastId}; the next scheduler run retries it`, error);
			});
		});
		return Promise.resolve();
	}
}
