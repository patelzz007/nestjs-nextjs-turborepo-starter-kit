import { Injectable } from "@nestjs/common";

import type { CommandAuditPort, SystemCommandAuditEntry } from "../../application/ports/command-audit.port";
import { AuditTrailService } from "./audit-trail.service";

@Injectable()
export class AuditTrailCommandAudit implements CommandAuditPort {
	public constructor(private readonly auditTrail: AuditTrailService) {}

	public record(entry: SystemCommandAuditEntry): Promise<void> {
		return this.auditTrail.recordSystemCommand(entry);
	}
}
