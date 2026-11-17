import type { ConditionAttribute } from "@workspace/shared";

import { NO_FACTS, type SubjectFacts } from "../../domain/evaluation/evaluation-subject";
import type { SubjectFactSource } from "../ports/subject-facts.port";

/**
 * The facts rules can read about a person, from the contexts that own them (registered when they start). A
 * fact is looked up only when a rule being evaluated reads it; one no context supplies stays null, and a
 * condition on it never matches.
 */
export class SubjectFactsRegistry {
	private readonly sources: SubjectFactSource[] = [];

	public register(source: SubjectFactSource): void {
		this.sources.push(source);
	}

	public async resolve(userId: string | null, attributes: ReadonlySet<ConditionAttribute>): Promise<SubjectFacts> {
		if (userId === null) {
			return NO_FACTS;
		}
		const emailDomain = attributes.has("EMAIL_DOMAIN") ? this.first((source) => source.emailDomain) : undefined;
		const platformStaff = attributes.has("PLATFORM_STAFF") ? this.first((source) => source.platformStaff) : undefined;
		const permissions = attributes.has("PERMISSION") ? this.first((source) => source.permissions) : undefined;
		const customerTier = attributes.has("CUSTOMER_TIER") ? this.first((source) => source.customerTier) : undefined;
		const [domain, staff, held, tier] = await Promise.all([
			emailDomain === undefined ? null : emailDomain(userId),
			platformStaff === undefined ? null : platformStaff(userId),
			permissions === undefined ? null : permissions(userId),
			customerTier === undefined ? null : customerTier(userId),
		]);
		return { emailDomain: domain, platformStaff: staff, permissions: held, customerTier: tier };
	}

	/** Whether the person works at the store; false when no context supplies the answer (fail closed). */
	public async worksAt(userId: string, tenantId: string, locationId: string | null): Promise<boolean> {
		const worksAt = this.first((source) => source.worksAt);
		return worksAt === undefined ? false : worksAt(userId, tenantId, locationId);
	}

	/** The first registered source of one fact. */
	private first<TFact>(pick: (source: SubjectFactSource) => TFact | undefined): TFact | undefined {
		for (const source of this.sources) {
			const fact = pick(source);
			if (fact !== undefined) {
				return fact;
			}
		}
		return undefined;
	}
}
