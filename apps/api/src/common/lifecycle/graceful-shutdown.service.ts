import { Injectable, type OnApplicationShutdown } from "@nestjs/common";

import { LogService } from "../../modules/logs/logs.service";

/** Logs when Nest begins tearing down modules during graceful shutdown. */
@Injectable()
export class GracefulShutdownService implements OnApplicationShutdown {
	public constructor(private readonly logService: LogService) {}

	public onApplicationShutdown(signal?: string): void {
		this.logService.info(`Nest shutdown hooks running${signal === undefined ? "" : ` (${signal})`}…`);
	}
}
