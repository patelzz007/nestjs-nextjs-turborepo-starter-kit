import { Injectable, Logger } from "@nestjs/common";

import type { OperationalAlert, OperationalAlertPort } from "../../application/ports/operational-alert.port";

/**
 * Writes an alert as an `error` log line marked `alert: true`, so on-call alerting can match one field
 * (`docs/technical/operations/observability.md`, "Alerts").
 */
@Injectable()
export class LoggerOperationalAlerts implements OperationalAlertPort {
	private readonly logger: Logger = new Logger("OperationalAlert");

	public raise(alert: OperationalAlert): void {
		this.logger.error({ alert: true, event: alert.event, message: alert.message, ...alert.facts });
	}
}
