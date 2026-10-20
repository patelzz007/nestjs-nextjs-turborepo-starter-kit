import type { AuthorizationPolicyDraftAggregate } from "../aggregates/authorization-policy-draft.aggregate";

/** Policy drafts, bound to one control-plane transaction. */
export interface PolicyDraftRepository {
	findById(draftId: string): Promise<AuthorizationPolicyDraftAggregate | null>;
	/** Inserts a new draft. */
	add(draft: AuthorizationPolicyDraftAggregate): Promise<void>;
	/**
	 * Claims the draft for publication, compared-and-set on the status it was loaded with and on a
	 * different approver. @throws PolicyDraftNotPublishableError("claimed") when 0 rows match.
	 */
	savePublished(draft: AuthorizationPolicyDraftAggregate): Promise<void>;
}
