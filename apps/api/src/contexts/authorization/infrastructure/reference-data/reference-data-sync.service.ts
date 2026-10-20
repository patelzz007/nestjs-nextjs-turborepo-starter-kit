import type { Prisma } from "@prisma/client";

import type { OperatorIdentity, OperatorIdentityProvider } from "../../../../platform/infrastructure/operator-identity";
import type { ReferenceDataSyncPort } from "../../application/ports/catalog-sync.port";
import type { PermissionAuditActor, PermissionAuditWriter } from "../../application/ports/permission-audit.port";
import { changeCount, type ReferenceDataSection, type ReferenceDataTransactionRunner, type SectionChange } from "./reference-data.types";
import { REFERENCE_DATA_SYNC_OPERATION } from "../../application/ports/authorization.tokens";

/** The permission audit writer bound to one section transaction. */
export type SectionAuditWriterFactory = (tx: Prisma.TransactionClient) => PermissionAuditWriter;

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
 * transaction, with the actor `{ kind: "SYSTEM_OPERATION", operation: REFERENCE_DATA_SYNC_OPERATION }` and the
 * operator (OS user, host) in the detail. A failing section rolls back alone; the sections before it stay
 * committed and a re-run continues from there.
 */
export class ReferenceDataSyncService implements ReferenceDataSyncPort {
	public constructor(
		private readonly run: ReferenceDataTransactionRunner,
		private readonly sections: readonly ReferenceDataSection[],
		private readonly auditWriterFor: SectionAuditWriterFactory,
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
			const actor: PermissionAuditActor = { kind: "SYSTEM_OPERATION", operation: REFERENCE_DATA_SYNC_OPERATION };
			const detail: SyncAuditDetail = { section: section.name, ...change, ranBy: this.operator.current() };
			await this.auditWriterFor(tx).append({ action: "REFERENCE_DATA_SYNCED", actor, detail: JSON.stringify(detail) });
		}
		return change;
	}
}
