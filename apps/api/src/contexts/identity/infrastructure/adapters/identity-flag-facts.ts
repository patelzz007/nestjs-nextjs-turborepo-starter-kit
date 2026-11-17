import type { SubjectFactSource } from "../../../feature-flags/public-api";
import type { SystemOperationName } from "../../../../platform/application/system-operation-names";
import type { FlagFactTransactions } from "../../../../platform/infrastructure/persistence/flag-fact-transactions";

/** The one written copy of the operation name (`system-operation-single-source.spec.ts`). */
const IDENTITY_FLAG_FACTS_OPERATION: SystemOperationName = "identity.flag_facts.read";

/** The part of an address after its last `@`. */
const EMAIL_DOMAIN_PATTERN = /@(?<domain>[^@]+)$/;

/** The lower-case domain of an email address, or null when it has none. */
export function emailDomainOf(email: string): string | null {
	return EMAIL_DOMAIN_PATTERN.exec(email)?.groups?.domain?.toLowerCase() ?? null;
}

/** Identity's part of the facts feature flag rules read (ADR 087): a person's email domain. */
export function identityFlagFacts(transactions: FlagFactTransactions): SubjectFactSource {
	return {
		emailDomain: (userId: string): Promise<string | null> =>
			transactions.withSystemOperation({ operation: IDENTITY_FLAG_FACTS_OPERATION, reason: "Feature flags: a person's email domain", actorUserId: null }, async (tx) => {
				const user = await tx.user.findFirst({ where: { id: userId, isDeleted: false }, select: { email: true } });
				return user === null ? null : emailDomainOf(user.email);
			}),
	};
}
