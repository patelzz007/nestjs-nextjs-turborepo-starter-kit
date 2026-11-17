import type { DynamicConfigKey, FeatureFlagKey, FlagGroupKey, RolloutUnit } from "@workspace/shared";

import type { CatalogConfigRevision, CatalogExperiment, CatalogFlagRevision, CatalogGroup, CatalogOverride, FlagCatalog } from "./flag-catalog";

/** A condition group, as stored. */
export type ConditionGroup = Extract<CatalogGroup, { kind: "CONDITIONS" }>;

/** A listed group, its members as a set. */
export interface ListGroup {
	readonly key: string;
	readonly kind: "LIST";
	readonly unit: RolloutUnit;
	readonly members: ReadonlySet<string>;
}

export type IndexedGroup = ConditionGroup | ListGroup;

function overrideKey(key: FeatureFlagKey, unit: CatalogOverride["unit"], subjectId: string): string {
	return `${key}|${unit}|${subjectId}`;
}

/** The catalogue's lookups, built once per catalogue version. */
export class CatalogIndex {
	public readonly version: number;
	private readonly killed: ReadonlySet<FeatureFlagKey>;
	private readonly flags: ReadonlyMap<FeatureFlagKey, CatalogFlagRevision>;
	private readonly configs: ReadonlyMap<DynamicConfigKey, CatalogConfigRevision>;
	private readonly overrides: ReadonlyMap<string, boolean>;
	private readonly groups: ReadonlyMap<string, IndexedGroup>;
	private readonly experiments: ReadonlyMap<DynamicConfigKey, CatalogExperiment>;

	public constructor(catalog: FlagCatalog) {
		this.version = catalog.version;
		this.killed = new Set(catalog.killSwitches);
		this.flags = new Map(catalog.flagRevisions.map((revision): [FeatureFlagKey, CatalogFlagRevision] => [revision.key, revision]));
		this.configs = new Map(catalog.configRevisions.map((revision): [DynamicConfigKey, CatalogConfigRevision] => [revision.key, revision]));
		this.overrides = new Map(catalog.overrides.map((override): [string, boolean] => [overrideKey(override.key, override.unit, override.subjectId), override.on]));
		this.groups = new Map(
			catalog.groups.map((group): [string, IndexedGroup] => [
				group.key,
				group.kind === "LIST" ? { key: group.key, kind: "LIST", unit: group.unit, members: new Set(group.members) } : group,
			]),
		);
		this.experiments = new Map(catalog.experiments.map((experiment): [DynamicConfigKey, CatalogExperiment] => [experiment.configKey, experiment]));
	}

	public isKilled(key: FeatureFlagKey): boolean {
		return this.killed.has(key);
	}

	public flagRevision(key: FeatureFlagKey): CatalogFlagRevision | null {
		return this.flags.get(key) ?? null;
	}

	public configRevision(key: DynamicConfigKey): CatalogConfigRevision | null {
		return this.configs.get(key) ?? null;
	}

	/** The override for one flag and subject, or null. */
	public override(key: FeatureFlagKey, unit: CatalogOverride["unit"], subjectId: string | null): boolean | null {
		return subjectId === null ? null : (this.overrides.get(overrideKey(key, unit, subjectId)) ?? null);
	}

	public group(key: FlagGroupKey): IndexedGroup | null {
		return this.groups.get(key) ?? null;
	}

	public runningExperiment(key: DynamicConfigKey): CatalogExperiment | null {
		return this.experiments.get(key) ?? null;
	}
}
