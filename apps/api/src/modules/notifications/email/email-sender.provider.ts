import type { Provider } from "@nestjs/common";

import { RequestContextService } from "../../../common/context/request-context";
import { EmailRecipientRateLimiter } from "./email-recipient-rate-limiter";

import { LogService } from "../../logs/logs.service";
import { TypedConfigService } from "../../../config/typed-config.service";
import { EmailLogService } from "./email-log.service";
import { EmailQueueService } from "./email-queue.service";
import { EmailSenderService } from "./email-sender.service";
import { EmailTransport } from "./transports/email-transport";

/** Wires `EmailQueueService` into `EmailSenderService` (must live in the queue module). */
export const emailSenderProvider: Provider = {
	provide: EmailSenderService,
	useFactory: (
		config: TypedConfigService,
		log: LogService,
		emailLog: EmailLogService,
		rateLimiter: EmailRecipientRateLimiter,
		requestContext: RequestContextService,
		transport: EmailTransport,
		queue: EmailQueueService,
	): EmailSenderService => new EmailSenderService(config, log, emailLog, rateLimiter, requestContext, transport, queue),
	inject: [TypedConfigService, LogService, EmailLogService, EmailRecipientRateLimiter, RequestContextService, EmailTransport, EmailQueueService],
};
