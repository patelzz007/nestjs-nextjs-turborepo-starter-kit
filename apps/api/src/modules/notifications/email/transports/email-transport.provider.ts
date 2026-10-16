import type { Provider } from "@nestjs/common";

import type { EmailConfig } from "../../../../config/api-config.schema";
import { TypedConfigService } from "../../../../config/typed-config.service";
import { LogService } from "../../../logs/logs.service";
import { EmailTransport } from "./email-transport";
import { MailpitEmailTransport } from "./mailpit-email.transport";
import { ResendEmailTransport } from "./resend-email.transport";

/** The transport `EMAIL_PROVIDER` selects. */
export function createEmailTransport(config: EmailConfig, logService: LogService): EmailTransport {
	switch (config.provider) {
		case "resend":
			return new ResendEmailTransport(config.resendApiKey);
		case "mailpit":
			return new MailpitEmailTransport(config, logService);
	}
}

/** Binds {@link EmailTransport} to the provider chosen by `EMAIL_PROVIDER`. */
export const emailTransportProvider: Provider = {
	provide: EmailTransport,
	useFactory: (config: TypedConfigService, logService: LogService): EmailTransport => createEmailTransport(config.email, logService),
	inject: [TypedConfigService, LogService],
};
