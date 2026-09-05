import type { Provider } from "@nestjs/common";

import { LogService } from "../../logs/logs.service";
import { TypedConfigService } from "../../../config/typed-config.service";
import { EmailLogService } from "./email-log.service";
import { EmailQueueService } from "./email-queue.service";
import { EmailSenderService } from "./email-sender.service";

/** Wires `EmailQueueService` into `EmailSenderService` (must live in the queue module). */
export const emailSenderProvider: Provider = {
	provide: EmailSenderService,
	useFactory: (config: TypedConfigService, log: LogService, emailLog: EmailLogService, queue: EmailQueueService): EmailSenderService =>
		new EmailSenderService(config, log, emailLog, queue),
	inject: [TypedConfigService, LogService, EmailLogService, EmailQueueService],
};
