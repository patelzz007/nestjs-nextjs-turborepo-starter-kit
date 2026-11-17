import { PENDING_REVISION_TTL_DAYS, type DeploymentEnvironment, type Revision, type RevisionContent, type RevisionSource } from "@workspace/shared";

import { actingUserId, type ActorContext } from "../../../../platform/application/actor-context";
import type { Clock } from "../../../../platform/application/clock.port";
import {
	FlagRevisionConflictError,
	FlagRevisionNotFoundError,
	FlagRevisionNotPendingError,
	FlagRulesInvalidError,
	FlagSelfApprovalError,
} from "../../domain/errors/feature-flag.errors";
import { approvalsRequired } from "../../domain/policies/flag-rules.policy";
import type { FlagAdminStore, FlagEntryKind } from "../ports/flag-admin.store";
import type { FlagCatalogSource } from "../ports/flag-catalog.port";

const MS_PER_DAY = 86_400_000;
const PENDING_TTL_MS = PENDING_REVISION_TTL_DAYS * MS_PER_DAY;

export interface RevisionDraft {
	readonly kind: FlagEntryKind;
	readonly key: string;
	readonly content: RevisionContent;
	readonly reason: string;
	readonly basedOn: number | null;
	readonly source: RevisionSource;
	readonly promotedFrom: DeploymentEnvironment | null;
}

/**
 * Writing and deciding revisions (ADR 086), the same for flags and configs: a save goes live at once, except in
 * production, where it waits up to a week for someone other than its author. A save refused when the live
 * revision moved since the author loaded it.
 */
export class RevisionWorkflow {
	public constructor(
		private readonly store: FlagAdminStore,
		private readonly catalog: FlagCatalogSource,
		private readonly clock: Clock,
		private readonly environment: DeploymentEnvironment,
	) {}

	public get approvalsRequired(): boolean {
		return approvalsRequired(this.environment);
	}

	public async save(actor: ActorContext, draft: RevisionDraft): Promise<Revision> {
		const at = this.clock.now();
		const outcome = await this.store.writeRevision(actor, { ...draft, pendingUntil: this.approvalsRequired ? at + PENDING_TTL_MS : null, at });
		switch (outcome.kind) {
			case "CONFLICT":
				throw new FlagRevisionConflictError(draft.key, draft.basedOn, outcome.live);
			case "PENDING_EXISTS":
				throw new FlagRulesInvalidError(draft.key, `Change ${String(outcome.pending)} is waiting for approval. Approve or reject it before proposing another.`);
			case "WRITTEN":
				await this.announce(outcome.written.version);
				return outcome.written.value;
		}
	}

	public async decide(actor: ActorContext, kind: FlagEntryKind, key: string, number: number, approve: boolean, reason: string): Promise<Revision> {
		const pending = (await this.store.revisions(actor, kind, key)).find((revision) => revision.number === number);
		if (pending === undefined) {
			throw new FlagRevisionNotFoundError(key, number);
		}
		if (pending.authorUserId !== null && pending.authorUserId === actingUserId(actor)) {
			throw new FlagSelfApprovalError(key);
		}
		const outcome = await this.store.decideRevision(actor, { kind, key, number, approve, reason, at: this.clock.now() });
		switch (outcome.kind) {
			case "NOT_FOUND":
				throw new FlagRevisionNotFoundError(key, number);
			case "NOT_PENDING":
				throw new FlagRevisionNotPendingError(key, number);
			case "SELF":
				throw new FlagSelfApprovalError(key);
			case "CONFLICT":
				throw new FlagRevisionConflictError(key, null, outcome.live);
			case "DECIDED":
				await this.announce(outcome.written.version);
				return outcome.written.value;
		}
	}

	private async announce(version: number | null): Promise<void> {
		if (version !== null) {
			await this.catalog.changed(version);
		}
	}
}
