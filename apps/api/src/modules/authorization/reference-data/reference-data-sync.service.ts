import type { Prisma } from "@prisma/client";

import type { OperatorIdentity, OperatorIdentityProvider } from "../../../common/operator-identity";
import type { SystemOperation } from "../../../prisma/system-operation.registry";
import { AuthorizationAuditService, type AuditActor } from "../audit/authorization-audit.service";
import { changeCount, type ReferenceDataSection, type ReferenceDataTransactionRunner, type SectionChange } from "./reference-data.types";

/** The system operation (and audit actor) the sync runs as. */
export const REFERENCE_DATA_SYNC_OPERATION: SystemOperation = "reference_data.sync";

export interface SectionReport {
	readonly section: string;
	readonly change: SectionChange;
}

export interface ReferenceDataSyncReport {
	readonly sections: readonly SectionReport[];
	readonly totalChanges: number;
}

interface SyncAuditDetail extends SectionChange {
	readonly section: string;
	readonly ranBy: OperatorIdentity;
}

/**
 * Converges the platform reference data to what the code defines, one section per transaction:
 * production-safe (diff-based — a run that finds nothing to change writes nothing, not even an
 * audit row — and never deletes rows an operator created), and idempotent.
 *
 * Each section that changed something writes one `REFERENCE_DATA_SYNCED` audit row IN THE SAME
 * transaction, with the actor `{ kind: "SYSTEM_OPERATION", operation: "reference_data.sync" }` and the
 * operator (OS user, host) in the detail. A failing section rolls back alone; the sections before it stay
 * committed and a re-run continues from there.
 */
export class ReferenceDataSyncService {
	public constructor(
		private readonly run: ReferenceDataTransactionRunner,
		private readonly sections: readonly ReferenceDataSection[],
		private readonly audit: AuthorizationAuditService,
		private readonly operator: OperatorIdentityProvider,
	) {}

	public async sync(): Promise<ReferenceDataSyncReport> {
		const reports: SectionReport[] = [];
		for (const section of this.sections) {
			const change: SectionChange = await this.run((tx: Prisma.TransactionClient): Promise<SectionChange> => this.syncSection(section, tx));
			reports.push({ section: section.name, change });
		}
		return { sections: reports, totalChanges: reports.reduce((sum: number, report: SectionReport): number => sum + changeCount(report.change), 0) };
	}

	private async syncSection(section: ReferenceDataSection, tx: Prisma.TransactionClient): Promise<SectionChange> {
		const change: SectionChange = await section.sync(tx);
		if (changeCount(change) > 0) {
			const actor: AuditActor = { kind: "SYSTEM_OPERATION", operation: REFERENCE_DATA_SYNC_OPERATION };
			const detail: SyncAuditDetail = { section: section.name, ...change, ranBy: this.operator.current() };
			await this.audit.record({ action: "REFERENCE_DATA_SYNCED", actor, detail: JSON.stringify(detail) }, tx);
		}
		return change;
	}
}
