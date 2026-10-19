import type { TransactionalEventCollector } from "../../../platform/application/events/transactional-event-collector";
import type { GeographyRepository } from "../domain/repositories/geography.repository";
import type { RequestAuditPort } from "./ports/request-audit.port";

/** Everything one reference-data transaction can touch. Every member is bound to that transaction. */
export interface ReferenceDataScope {
	readonly geography: GeographyRepository;
	readonly requestAudit: RequestAuditPort;
	readonly events: TransactionalEventCollector;
}
