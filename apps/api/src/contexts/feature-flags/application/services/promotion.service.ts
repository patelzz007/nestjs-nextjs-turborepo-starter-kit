import {
	epochMs,
	PROMOTION_FORMAT_VERSION,
	type PromotionHeader,
	type DeploymentEnvironment,
	type FlagGroup,
	type PromotedFlagGroup,
	type PromotedGroupChange,
	type PromotionExportQuery,
	type PromotionFile,
	type PromotionPreview,
	type Revision,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { Clock } from "../../../../platform/application/clock.port";
import { FlagRulesInvalidError, PromotionInvalidError } from "../../domain/errors/feature-flag.errors";
import { assertValidConfigContent, assertValidFlagRules, groupKeysOf } from "../../domain/policies/flag-rules.policy";
import type { FlagAdminStore } from "../ports/flag-admin.store";
import type { FlagCatalogSource } from "../ports/flag-catalog.port";
import type { FlagGroupStore } from "../ports/flag-group.store";
import type { RevisionWorkflow } from "./revision-workflow";

/** Two values hold the same JSON (key order included, as both come from the same schemas). */
function sameJson(left: object, right: object): boolean {
	return JSON.stringify(left) === JSON.stringify(right);
}

function promoted(group: FlagGroup): PromotedFlagGroup | null {
	return group.definition.kind === "CONDITIONS" ? { key: group.key, name: group.name, description: group.description, conditions: group.definition.conditions } : null;
}

/**
 * Rule promotion (GLOSSARY): a live revision leaves one environment as a file and arrives in another as a new
 * revision (pending in production), after its difference was reviewed. Condition groups travel with it and are
 * created or updated on import; listed groups must already exist here.
 */
export class PromotionService {
	public constructor(
		private readonly flags: FlagAdminStore,
		private readonly groups: FlagGroupStore,
		private readonly workflow: RevisionWorkflow,
		private readonly catalog: FlagCatalogSource,
		private readonly clock: Clock,
		private readonly environment: DeploymentEnvironment,
	) {}

	public async export(actor: ActorContext, query: PromotionExportQuery): Promise<PromotionFile> {
		const live = (await this.flags.heads(actor, query.kind)).get(query.key)?.live ?? null;
		if (live === null) {
			throw new PromotionInvalidError(query.key, "There are no live rules to promote yet.");
		}
		const named = new Set(groupKeysOf(live.content.rules));
		const groups = (await this.groups.list(actor)).filter((group) => named.has(group.key));
		const header: PromotionHeader = {
			formatVersion: PROMOTION_FORMAT_VERSION,
			environment: this.environment,
			exportedAt: epochMs(this.clock.now()),
			revision: live.number,
			groups: groups.flatMap((group) => {
				const travelling = promoted(group);
				return travelling === null ? [] : [travelling];
			}),
			listedGroupKeys: groups.filter((group) => group.definition.kind === "LIST").map((group) => group.key),
		};
		if (query.kind === "FLAG" && live.content.kind === "FLAG") {
			return { kind: "FLAG", key: query.key, content: live.content, ...header };
		}
		if (query.kind === "CONFIG" && live.content.kind === "CONFIG") {
			return { kind: "CONFIG", key: query.key, content: live.content, ...header };
		}
		throw new PromotionInvalidError(query.key, "The live revision doesn't match its kind.");
	}

	public async preview(actor: ActorContext, file: PromotionFile): Promise<PromotionPreview> {
		const [heads, groups] = await Promise.all([this.flags.heads(actor, file.kind), this.groups.list(actor)]);
		const current: Revision | null = heads.get(file.key)?.live ?? null;
		const byKey = new Map(groups.map((group): [string, FlagGroup] => [group.key, group]));
		return {
			kind: file.kind,
			key: file.key,
			from: file.environment,
			to: this.environment,
			current,
			incoming: file.content,
			identical: current !== null && sameJson(current.content, file.content),
			groups: file.groups.map((group): PromotedGroupChange => ({ key: group.key, change: this.groupChange(group, byKey.get(group.key) ?? null) })),
			missingListedGroups: file.listedGroupKeys.filter((key) => byKey.get(key)?.definition.kind !== "LIST"),
			needsApproval: this.workflow.approvalsRequired,
		};
	}

	public async import(actor: ActorContext, file: PromotionFile, reason: string): Promise<Revision> {
		if (file.environment === this.environment) {
			throw new PromotionInvalidError(file.key, "This file came from this environment; there is nothing to promote.");
		}
		const preview = await this.preview(actor, file);
		if (preview.missingListedGroups.length > 0) {
			throw new PromotionInvalidError(file.key, `Create these listed groups here first: ${preview.missingListedGroups.join(", ")}.`);
		}
		const listedHere = preview.groups.filter((group) => group.change === "LISTED_HERE").map((group) => group.key);
		if (listedHere.length > 0) {
			throw new PromotionInvalidError(file.key, `These groups are listed groups here, not condition groups: ${listedHere.join(", ")}.`);
		}
		await this.carryGroups(actor, file.groups, reason);
		const groupKeys = new Set((await this.groups.list(actor)).map((group) => group.key));
		if (file.kind === "FLAG") {
			assertValidFlagRules(file.key, file.content.rules, groupKeys);
		} else {
			assertValidConfigContent(file.key, file.content, groupKeys);
		}
		return this.workflow.save(actor, {
			kind: file.kind,
			key: file.key,
			content: file.content,
			reason,
			basedOn: preview.current?.number ?? null,
			source: "PROMOTION",
			promotedFrom: file.environment,
		});
	}

	private groupChange(incoming: PromotedFlagGroup, existing: FlagGroup | null): PromotedGroupChange["change"] {
		if (existing === null) {
			return "NEW";
		}
		if (existing.definition.kind === "LIST") {
			return "LISTED_HERE";
		}
		return sameJson(existing.definition.conditions, incoming.conditions) && existing.name === incoming.name && existing.description === incoming.description
			? "SAME"
			: "CHANGED";
	}

	/** Creates or updates the travelling condition groups before the rules that name them arrive. */
	private async carryGroups(actor: ActorContext, incoming: readonly PromotedFlagGroup[], reason: string): Promise<void> {
		const existing = new Map((await this.groups.list(actor)).map((group): [string, FlagGroup] => [group.key, group]));
		for (const group of incoming) {
			const here = existing.get(group.key) ?? null;
			const change = this.groupChange(group, here);
			if (change === "NEW") {
				const created = await this.groups.create(actor, {
					key: group.key,
					name: group.name,
					description: group.description,
					definition: { kind: "CONDITIONS", conditions: group.conditions },
					reason,
				});
				if (created === null) {
					throw new FlagRulesInvalidError(group.key, "A group with this key appeared meanwhile; try the import again.");
				}
				await this.announce(created.version);
			} else if (change === "CHANGED" && here !== null) {
				const updated = await this.groups.update(actor, here.id, { name: group.name, description: group.description, conditions: group.conditions, reason });
				await this.announce(updated?.version ?? null);
			}
		}
	}

	private async announce(version: number | null): Promise<void> {
		if (version !== null) {
			await this.catalog.changed(version);
		}
	}
}
