import { Module } from "@nestjs/common";

import { CLOCK } from "../application/clock.port";
import { COMMAND_AUDIT } from "../application/ports/command-audit.port";
import { CORRELATION_SCOPE } from "../application/ports/correlation-scope.port";
import { OPERATIONAL_ALERTS } from "../application/ports/operational-alert.port";
import { SystemCommandDispatcher } from "../application/system-command-dispatcher";
import { AuditLogModule } from "./audit/audit-log.module";
import { AuditTrailCommandAudit } from "./audit/audit-trail-command-audit";
import { AsyncLocalCorrelationScope } from "./context/work-correlation";
import { LoggerOperationalAlerts } from "./logging/logger-operational-alerts";
import { SystemClock } from "./system-clock";

/**
 * The system-command dispatcher and its ports. `CommandBus` comes from the one
 * global `CqrsModule.forRoot()` in `AppModule`: importing the static
 * `CqrsModule` here would create a second bus (review finding 5).
 */
@Module({
	imports: [AuditLogModule],
	providers: [
		SystemClock,
		{ provide: CLOCK, useExisting: SystemClock },
		AuditTrailCommandAudit,
		{ provide: COMMAND_AUDIT, useExisting: AuditTrailCommandAudit },
		AsyncLocalCorrelationScope,
		{ provide: CORRELATION_SCOPE, useExisting: AsyncLocalCorrelationScope },
		LoggerOperationalAlerts,
		{ provide: OPERATIONAL_ALERTS, useExisting: LoggerOperationalAlerts },
		SystemCommandDispatcher,
	],
	exports: [SystemCommandDispatcher, CLOCK],
})
export class SystemCommandModule {}
