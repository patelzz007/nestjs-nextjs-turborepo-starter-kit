import type { PersonalDataEraser } from "../../../../platform/application/personal-data/personal-data-erasure.registry";
import type { PersonalDataExporter, PersonalDataSectionContent, PersonalDataSubject } from "../../../../platform/application/personal-data/personal-data-export.registry";
import { systemOperationEraser, type ErasureSystemTransactions } from "../../../../platform/infrastructure/personal-data/erasure-helpers";
import { rowsToJson } from "../../../../platform/infrastructure/personal-data/read-as-person";
import { FEATURE_FLAGS_READ_OPERATION } from "../../application/ports/feature-flags.operations";
import type { FlagTransactions } from "../persistence/flag-transactions";

/**
 * The feature flags section of "Download my data" (ADR 077, ADR 087): flag overrides naming the person, the listed
 * flag groups they are in, and the exposures recorded for them. The tables are platform data (no person reads them
 * under their own session), so the section is read under `feature_flags.read` for that one person.
 */
export class FeatureFlagsPersonalDataExporter implements PersonalDataExporter {
	public readonly section = "feature-flags";
	public readonly description = "Feature flags forced on or off for you, the flag groups you are listed in, and which flag values you were given";

	public constructor(private readonly transactions: FlagTransactions) {}

	public export({ userId }: PersonalDataSubject): Promise<PersonalDataSectionContent> {
		return this.transactions.withSystemOperation(
			{ operation: FEATURE_FLAGS_READ_OPERATION, reason: "Download my data: the person's feature flag records", actorUserId: userId },
			async (tx): Promise<PersonalDataSectionContent> => {
				const [overrides, memberships, exposures, metrics] = await Promise.all([
					tx.featureFlagOverride.findMany({
						where: { userId },
						orderBy: { createdAt: "asc" },
						select: { key: true, isOn: true, reason: true, createdAt: true, isDeleted: true },
					}),
					tx.flagGroupMember.findMany({
						where: { subjectId: userId, group: { unit: "USER" } },
						orderBy: { createdAt: "asc" },
						select: { createdAt: true, isDeleted: true, group: { select: { key: true, name: true } } },
					}),
					tx.featureFlagExposure.findMany({
						where: { subjectUnit: "USER", subjectId: userId },
						orderBy: { occurredAt: "asc" },
						select: { kind: true, key: true, app: true, value: true, source: true, occurredAt: true },
					}),
					tx.experimentMetricEvent.findMany({ where: { userId }, orderBy: { occurredAt: "asc" }, select: { metric: true, occurredAt: true } }),
				]);
				return {
					records: overrides.length + memberships.length + exposures.length + metrics.length,
					data: { overrides: rowsToJson(overrides), groups: rowsToJson(memberships), exposures: rowsToJson(exposures), experimentMetrics: rowsToJson(metrics) },
				};
			},
		);
	}
}

/**
 * Feature flags' part of erasure (ADR 077): overrides naming the person, their listed-group memberships, their
 * exposures and their experiment metric occurrences go. Groups, revisions, daily sums and results hold no person.
 */
export function featureFlagsEraser(transactions: ErasureSystemTransactions): PersonalDataEraser {
	return systemOperationEraser("feature-flags", transactions, (tx, { userId }) =>
		Promise.all([
			tx.featureFlagOverride.deleteMany({ where: { userId } }),
			tx.flagGroupMember.deleteMany({ where: { subjectId: userId, group: { unit: "USER" } } }),
			tx.featureFlagExposure.deleteMany({ where: { subjectUnit: "USER", subjectId: userId } }),
			tx.experimentMetricEvent.deleteMany({ where: { userId } }),
		]),
	);
}
