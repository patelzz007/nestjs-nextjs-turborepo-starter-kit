import { KybStatusSchema, type EpochMs, type JsonObject, type KybDocumentScanStatus, type KybStatus } from "@workspace/shared";

import { AggregateRoot } from "../../../../platform/domain/aggregate-root";
import {
	KybAlreadyApprovedError,
	KybDecisionReasonRequiredError,
	KybDocumentIncompleteError,
	KybDocumentInvalidError,
	KybDocumentRejectedError,
	KybReviewClosedError,
	KybTransitionNotAllowedError,
	TenantsCorruptStateError,
} from "../errors/tenants.errors";
import { MerchantVerificationStatusChanged, type TenantsDomainEvent } from "../events/tenants.events";
import { evidenceAllClean, evidenceNeedsAction, kybDocumentScanStatusOf, kybEvidenceRejectionOf, type KybEvidenceFile } from "../policies/kyb-evidence.policy";

/**
 * Admin decisions allowed from each review status (D05, migration plan §7.5).
 * A rejected review never reopens through an admin decision: the merchant
 * resubmits. Nothing is decided back to PENDING; that is the merchant's submit.
 */
const ADMIN_DECISIONS: Readonly<Record<KybStatus, readonly KybStatus[]>> = {
	PENDING: ["APPROVED", "REJECTED", "ACTION_REQUIRED"],
	ACTION_REQUIRED: ["APPROVED", "REJECTED"],
	APPROVED: ["REJECTED", "ACTION_REQUIRED"],
	REJECTED: [],
};

/** Decisions that must say why (the contract enforces it; the aggregate re-checks it). */
const DECISIONS_REQUIRING_REASON: readonly KybStatus[] = ["REJECTED", "ACTION_REQUIRED"];

/** Review outcomes the scan verdicts can no longer change. */
const DECIDED_STATUSES: readonly KybStatus[] = ["APPROVED", "REJECTED"];

/** Statuses in which the signed-out onboarding link may no longer replace the evidence. */
const ONBOARDING_CLOSED_STATUSES: readonly KybStatus[] = ["APPROVED", "REJECTED"];

/** The business details a merchant submits for review. */
export interface KybApplication {
	readonly legalName: string;
	readonly addressText: string;
	readonly contactPhone: string;
	readonly kybFields: JsonObject;
	/** Only onboarding states the business category. */
	readonly category: string | null;
}

export interface MerchantVerificationState {
	readonly tenantId: string;
	readonly kybStatus: string;
}

/**
 * The KYB review of one merchant tenant (stored on its merchant
 * profile). Owns the review status machine: merchant submission, scan-verdict
 * reconciliation and the admin decision table.
 */
export class MerchantVerification extends AggregateRoot<TenantsDomainEvent> {
	private status: KybStatus;
	private submittedApplication: KybApplication | null = null;
	private replacedEvidenceFileIds: readonly string[] | null = null;
	private decidedKybFields: JsonObject | null = null;

	private constructor(
		public readonly tenantId: string,
		private readonly loadedStatus: KybStatus,
	) {
		super();
		this.status = loadedStatus;
	}

	public static rehydrate(state: MerchantVerificationState): MerchantVerification {
		const parsed = KybStatusSchema.safeParse(state.kybStatus);
		if (!parsed.success) {
			throw new TenantsCorruptStateError(state.tenantId);
		}
		return new MerchantVerification(state.tenantId, parsed.data);
	}

	/** The status this review was loaded with; persistence compares it (CAS). */
	public get concurrencyToken(): KybStatus {
		return this.loadedStatus;
	}

	public get currentStatus(): KybStatus {
		return this.status;
	}

	/** The business details to store, when this unit of work submitted them. */
	public get pendingApplication(): KybApplication | null {
		return this.submittedApplication;
	}

	/** The files that become the active evidence, when this unit of work replaced it. */
	public get pendingEvidenceFileIds(): readonly string[] | null {
		return this.replacedEvidenceFileIds;
	}

	/** The admin's decision fields (reason) to store, when this unit of work decided. */
	public get pendingDecisionKybFields(): JsonObject | null {
		return this.decidedKybFields;
	}

	/**
	 * Signed-in merchant (re)submission: any status except APPROVED reopens the
	 * review as PENDING with the new details and evidence; previous evidence is
	 * retired. `evidence` are the files found for `fileIds` (missing ids are absent).
	 */
	public submit(application: KybApplication, fileIds: readonly string[], evidence: readonly KybEvidenceFile[], now: EpochMs): void {
		if (this.status === "APPROVED") {
			throw new KybAlreadyApprovedError();
		}
		const accepted = this.acceptEvidence(fileIds, evidence);
		this.submittedApplication = application;
		this.transition("PENDING", now);
		this.replaceEvidence(accepted, now);
	}

	/**
	 * Evidence sent through the onboarding link: refused once the review is
	 * decided (APPROVED or REJECTED). The status follows the evidence's scans.
	 */
	public submitOnboardingEvidence(fileIds: readonly string[], evidence: readonly KybEvidenceFile[], now: EpochMs): void {
		if (ONBOARDING_CLOSED_STATUSES.includes(this.status)) {
			throw new KybReviewClosedError(this.status);
		}
		const accepted = this.acceptEvidence(fileIds, evidence);
		this.replaceEvidence(accepted, now);
	}

	/** The onboarding application: details stored, review (re)opened as PENDING. */
	public applyOnboardingApplication(application: KybApplication, now: EpochMs): void {
		this.submittedApplication = application;
		this.transition("PENDING", now);
	}

	/**
	 * Re-derive the status from the active evidence's scan states (a verdict
	 * landed). A decided review is never changed; infected or unscannable
	 * evidence needs merchant action; all clean again returns ACTION_REQUIRED to PENDING.
	 */
	public reconcile(evidence: readonly KybEvidenceFile[], now: EpochMs): void {
		if (DECIDED_STATUSES.includes(this.status) || evidence.length === 0) {
			return;
		}
		const statuses: readonly KybDocumentScanStatus[] = evidence.map((file) => kybDocumentScanStatusOf(file));
		if (evidenceNeedsAction(statuses)) {
			this.transition("ACTION_REQUIRED", now);
			return;
		}
		if (evidenceAllClean(statuses) && this.status === "ACTION_REQUIRED") {
			this.transition("PENDING", now);
		}
	}

	/** Admin decision, checked against {@link ADMIN_DECISIONS}. REJECTED and ACTION_REQUIRED need a reason. */
	public decide(to: KybStatus, reason: string | null, kybFields: JsonObject | null, now: EpochMs): void {
		if (!ADMIN_DECISIONS[this.status].includes(to)) {
			throw new KybTransitionNotAllowedError(this.tenantId, this.status, to);
		}
		if (DECISIONS_REQUIRING_REASON.includes(to) && (reason === null || reason.trim().length === 0)) {
			throw new KybDecisionReasonRequiredError(to);
		}
		this.decidedKybFields = kybFields;
		this.transition(to, now);
	}

	/** Validates every requested file and returns them in request order, without duplicates. */
	private acceptEvidence(fileIds: readonly string[], evidence: readonly KybEvidenceFile[]): readonly KybEvidenceFile[] {
		const uniqueIds = [...new Set(fileIds)];
		return uniqueIds.map((fileId): KybEvidenceFile => {
			const file = evidence.find((candidate) => candidate.id === fileId);
			const rejection = kybEvidenceRejectionOf(file, this.tenantId);
			if (rejection === "INVALID" || file === undefined) {
				throw new KybDocumentInvalidError();
			}
			if (rejection === "INCOMPLETE") {
				throw new KybDocumentIncompleteError();
			}
			if (rejection === "NOT_SUBMITTABLE") {
				throw new KybDocumentRejectedError(file.status);
			}
			return file;
		});
	}

	private replaceEvidence(evidence: readonly KybEvidenceFile[], now: EpochMs): void {
		this.replacedEvidenceFileIds = evidence.map((file) => file.id);
		this.reconcile(evidence, now);
	}

	private transition(to: KybStatus, now: EpochMs): void {
		if (to === this.status) {
			return;
		}
		const from = this.status;
		this.status = to;
		this.record(new MerchantVerificationStatusChanged(now, this.tenantId, from, to));
	}
}
