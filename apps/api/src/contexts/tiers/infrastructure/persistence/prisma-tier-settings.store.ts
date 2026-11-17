import type { Prisma } from "@prisma/client";
import { epochMs, type EpochMs, type TierRules, type TierSettingsResponse, type UpdateTierSettingsInput } from "@workspace/shared";

import { actingUserId, type ActorContext } from "../../../../platform/application/actor-context";
import type { TierSettingsStore } from "../../application/ports/tier-settings.store";
import { TIER_SETTINGS_WRITE_OPERATION, TIER_STANDING_READ_OPERATION } from "../../application/ports/tiers.tokens";
import type { TierReadTransactions } from "./prisma-tier.read-repository";
import { readTierRules, TIER_RULES_SELECT, TIER_SETTINGS_KEY, tierRulesOf } from "./tier-settings.mapper";

/** The settings row as staff see it: the rules, why they last changed, when and by whom. */
const SETTINGS_SELECT = { ...TIER_RULES_SELECT, reason: true, updatedAt: true, updatedBy: true } satisfies Prisma.CustomerTierSettingsSelect;

/** {@link TierSettingsStore} over Prisma (ADR 085): one row under the key "default", the defaults until the first change. */
export class PrismaTierSettingsStore implements TierSettingsStore {
	public constructor(private readonly transactions: TierReadTransactions) {}

	public rules(): Promise<TierRules> {
		return this.transactions.withSystemOperation({ operation: TIER_STANDING_READ_OPERATION, reason: "Tiers: the rules in force", actorUserId: null }, readTierRules);
	}

	public settings(actor: ActorContext): Promise<TierSettingsResponse> {
		return this.transactions.withSystemOperation(
			{ operation: TIER_STANDING_READ_OPERATION, reason: "Tiers: the rules and who changed them", actorUserId: actingUserId(actor) },
			async (db) => {
				const row = await db.customerTierSettings.findFirst({ where: { key: TIER_SETTINGS_KEY, isDeleted: false }, select: SETTINGS_SELECT });
				if (row === null) {
					return { ...tierRulesOf(null), reason: null, updatedAt: null, updatedByName: null };
				}
				const editor = row.updatedBy === null ? null : await db.user.findFirst({ where: { id: row.updatedBy }, select: { fullName: true } });
				return { ...tierRulesOf(row), reason: row.reason, updatedAt: epochMs(Number(row.updatedAt)), updatedByName: editor?.fullName ?? null };
			},
		);
	}

	public async save(actor: ActorContext, input: UpdateTierSettingsInput, at: EpochMs): Promise<TierSettingsResponse> {
		const editorId = actingUserId(actor);
		const { reason, ...rules } = input;
		const now = BigInt(at);
		await this.transactions.withSystemOperation({ operation: TIER_SETTINGS_WRITE_OPERATION, reason: "Tiers: change the rules", actorUserId: editorId }, async (db) => {
			await db.customerTierSettings.upsert({
				where: { key: TIER_SETTINGS_KEY },
				create: { key: TIER_SETTINGS_KEY, ...rules, reason, createdAt: now, createdBy: editorId, updatedAt: now, updatedBy: editorId },
				update: { ...rules, reason, updatedAt: now, updatedBy: editorId },
			});
		});
		return this.settings(actor);
	}
}
