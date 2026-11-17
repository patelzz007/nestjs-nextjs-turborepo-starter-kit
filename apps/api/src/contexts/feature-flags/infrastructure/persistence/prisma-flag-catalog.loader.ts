import {
	ConditionSchema,
	ConfigRevisionContentSchema,
	DynamicConfigKeySchema,
	ExperimentVariantSchema,
	FeatureFlagKeySchema,
	FlagRevisionContentSchema,
	RolloutUnitSchema,
} from "@workspace/shared";
import { z } from "zod";

import type { FlagCatalogLoader } from "../../application/ports/flag-catalog.port";
import { FEATURE_FLAGS_EVALUATE_OPERATION } from "../../application/ports/feature-flags.operations";
import type { CatalogGroup, CatalogOverride, FlagCatalog } from "../../domain/catalog/flag-catalog";
import { readCatalogVersion, type FlagTransactions } from "./flag-transactions";

const ConditionListSchema = z.array(ConditionSchema);
const VariantListSchema = z.array(ExperimentVariantSchema);

/**
 * Loads the catalogue (ADR 087) under `feature_flags.evaluate`: the version, thrown kill switches, live revisions,
 * live overrides, live groups with their live members, running experiments. A row naming a key the code no longer
 * declares (a flag since removed) is skipped; stored JSON is parsed against the shared schemas.
 */
export class PrismaFlagCatalogLoader implements FlagCatalogLoader {
	public constructor(private readonly transactions: FlagTransactions) {}

	public load(): Promise<FlagCatalog> {
		return this.transactions.withSystemOperation(
			{ operation: FEATURE_FLAGS_EVALUATE_OPERATION, reason: "Feature flags: load the catalogue", actorUserId: null },
			async (tx) => {
				const [version, killSwitches, revisions, overrides, groups, experiments] = await Promise.all([
					readCatalogVersion(tx),
					tx.featureFlagKillSwitch.findMany({ where: { isDeleted: false, isOn: true }, select: { key: true } }),
					tx.flagRevision.findMany({ where: { status: "LIVE" }, select: { kind: true, key: true, number: true, content: true } }),
					tx.featureFlagOverride.findMany({ where: { isDeleted: false }, select: { key: true, unit: true, userId: true, locationId: true, tenantId: true, isOn: true } }),
					tx.flagGroup.findMany({
						where: { isDeleted: false },
						select: { key: true, kind: true, unit: true, conditions: true, members: { where: { isDeleted: false }, select: { subjectId: true } } },
					}),
					tx.experiment.findMany({
						where: { isDeleted: false, status: "RUNNING" },
						select: { id: true, configKey: true, salt: true, trafficPercentage: true, variants: true },
					}),
				]);
				return {
					version,
					killSwitches: killSwitches.flatMap((row) => {
						const key = FeatureFlagKeySchema.safeParse(row.key);
						return key.success ? [key.data] : [];
					}),
					flagRevisions: revisions.flatMap((row) => {
						const key = FeatureFlagKeySchema.safeParse(row.key);
						return row.kind === "FLAG" && key.success ? [{ key: key.data, number: row.number, rules: FlagRevisionContentSchema.parse(row.content).rules }] : [];
					}),
					configRevisions: revisions.flatMap((row) => {
						const key = DynamicConfigKeySchema.safeParse(row.key);
						return row.kind === "CONFIG" && key.success ? [{ key: key.data, number: row.number, content: ConfigRevisionContentSchema.parse(row.content) }] : [];
					}),
					overrides: overrides.flatMap((row): CatalogOverride[] => {
						const key = FeatureFlagKeySchema.safeParse(row.key);
						const subjectId = row.unit === "USER" ? row.userId : row.unit === "LOCATION" ? row.locationId : row.tenantId;
						return key.success && subjectId !== null ? [{ key: key.data, unit: row.unit, subjectId, on: row.isOn }] : [];
					}),
					groups: groups.map((row): CatalogGroup =>
						row.kind === "LIST"
							? { key: row.key, kind: "LIST", unit: RolloutUnitSchema.parse(row.unit), members: row.members.map((member) => member.subjectId) }
							: { key: row.key, kind: "CONDITIONS", conditions: ConditionListSchema.parse(row.conditions) },
					),
					experiments: experiments.flatMap((row) => {
						const configKey = DynamicConfigKeySchema.safeParse(row.configKey);
						return configKey.success
							? [{ id: row.id, configKey: configKey.data, salt: row.salt, trafficPercentage: row.trafficPercentage, variants: VariantListSchema.parse(row.variants) }]
							: [];
					}),
				};
			},
		);
	}
}
