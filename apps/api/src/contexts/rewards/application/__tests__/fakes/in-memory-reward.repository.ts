import { ConflictError } from "../../../../../platform/application/errors/app-error";
import { Reward } from "../../../domain/aggregates/reward.aggregate";
import type { RewardRowState, RewardSnapshot, RewardState } from "../../../domain/aggregates/reward.state";
import { RewardNotFoundError } from "../../../domain/errors/reward.errors";
import type { RewardRepository } from "../../../domain/repositories/reward.repository";

/** The stored row of a snapshot, as a later load would read it. */
function toState(snapshot: RewardSnapshot, previous: RewardState | undefined): RewardState {
	const referrer: RewardRowState | null =
		snapshot.referrer === null
			? null
			: {
					id: snapshot.referrer.id,
					kind: "REFERRER",
					status: snapshot.referrer.review.status,
					title: snapshot.referrer.title,
					description: snapshot.referrer.description,
					offer: snapshot.referrer.offer,
					startDate: null,
					expiryDate: snapshot.referrer.expiryDate,
					inventory: snapshot.referrer.inventory,
					submittedForReviewAt: snapshot.referrer.review.submittedForReviewAt,
					autoPublishAt: snapshot.referrer.review.autoPublishAt,
					reviewedAt: snapshot.referrer.review.reviewedAt,
					reviewedByUserId: snapshot.referrer.review.reviewedByUserId,
					updatedAt: snapshot.referrer.updatedAt,
				};
	return {
		id: snapshot.id,
		kind: snapshot.kind,
		tenantId: snapshot.tenantId,
		status: snapshot.review.status,
		title: snapshot.title,
		description: snapshot.description,
		offer: snapshot.offer,
		rules: snapshot.rules,
		startDate: snapshot.startDate,
		expiryDate: snapshot.expiryDate,
		inventory: snapshot.inventory,
		submittedForReviewAt: snapshot.review.submittedForReviewAt,
		autoPublishAt: snapshot.review.autoPublishAt,
		reviewedAt: snapshot.review.reviewedAt,
		reviewedByUserId: snapshot.review.reviewedByUserId,
		rejectionReason: snapshot.rejectionReason,
		referralsEnabled: snapshot.referralsEnabled,
		referralPoolTotal: snapshot.referralPoolTotal,
		referralPoolRemaining: snapshot.referralPoolRemaining,
		locationScope: snapshot.locationScope,
		imageFileIds: snapshot.imageFileIds,
		availableAtActiveStore: previous?.availableAtActiveStore ?? true,
		updatedAt: snapshot.updatedAt,
		referrer,
	};
}

/**
 * A real {@link RewardRepository} in memory, with the same compare-and-set on the loaded
 * status / updatedAt / autoPublishAt as the Prisma adapter. `forceConflictOnNextSave` simulates
 * a concurrent writer winning the race.
 */
export class InMemoryRewardRepository implements RewardRepository {
	public readonly rows: Map<string, RewardState> = new Map<string, RewardState>();
	public readonly added: string[] = [];
	public readonly saved: string[] = [];
	public readonly lockedForInventory: string[] = [];
	public readonly lockedForReferralCredit: string[] = [];
	/** Each `lockForCheckout` call: the live rewards and referrer children it locked, in lock order. */
	public readonly lockedForCheckout: (readonly string[])[] = [];
	/** Who replaced a reward's images, per successful save that replaced them. */
	public readonly imageReplacements: { readonly actorId: string; readonly at: number }[] = [];
	private conflictPending = false;

	public seed(state: RewardState): this {
		this.rows.set(state.id, state);
		return this;
	}

	public forceConflictOnNextSave(): this {
		this.conflictPending = true;
		return this;
	}

	public getConsumerInTenant(tenantId: string, rewardId: string): Promise<Reward> {
		const row = this.rows.get(rewardId);
		if (row?.kind !== "CONSUMER" || row.tenantId !== tenantId) {
			return Promise.reject(new RewardNotFoundError(rewardId));
		}
		return Promise.resolve(Reward.rehydrate(row));
	}

	public async getConsumer(rewardId: string): Promise<Reward> {
		const reward = await this.findConsumer(rewardId);
		if (reward === null) {
			throw new RewardNotFoundError(rewardId);
		}
		return reward;
	}

	public findConsumer(rewardId: string): Promise<Reward | null> {
		const row = this.rows.get(rewardId);
		return Promise.resolve(row?.kind === "CONSUMER" ? Reward.rehydrate(row) : null);
	}

	public getLive(rewardId: string): Promise<Reward> {
		const row = this.rows.get(rewardId);
		return row === undefined ? Promise.reject(new RewardNotFoundError(rewardId)) : Promise.resolve(Reward.rehydrate(row));
	}

	public getForInventory(rewardId: string): Promise<Reward> {
		this.lockedForInventory.push(rewardId);
		return this.getLive(rewardId);
	}

	public lockForCheckout(rewardIds: readonly string[]): Promise<void> {
		const live = [...this.rows.values()].filter((row): boolean => rewardIds.includes(row.id));
		const children = live.flatMap((row): string[] => (row.referrer === null ? [] : [row.referrer.id]));
		this.lockedForCheckout.push([...new Set([...live.map((row): string => row.id), ...children])].sort((left, right) => left.localeCompare(right)));
		return Promise.resolve();
	}

	public getForReferralCredit(rewardId: string): Promise<Reward> {
		this.lockedForReferralCredit.push(rewardId);
		return this.getLive(rewardId);
	}

	public add(reward: Reward): Promise<void> {
		const snapshot = reward.snapshot();
		this.added.push(snapshot.id);
		this.rows.set(snapshot.id, toState(snapshot, undefined));
		return Promise.resolve();
	}

	public async save(reward: Reward): Promise<void> {
		if (!(await this.saveIfUnchanged(reward))) {
			throw new ConflictError({ message: "The resource was changed by another request. Reload it and try again." });
		}
	}

	public saveIfUnchanged(reward: Reward): Promise<boolean> {
		const stored = this.rows.get(reward.id);
		const token = reward.concurrencyToken;
		const dueBy = reward.autoPublishDueBy;
		const matches =
			!this.conflictPending &&
			stored !== undefined &&
			token !== null &&
			stored.status === token.status &&
			stored.updatedAt === token.updatedAt &&
			stored.autoPublishAt === token.autoPublishAt &&
			(dueBy === null || (stored.autoPublishAt !== null && stored.autoPublishAt <= dueBy));
		this.conflictPending = false;
		if (!matches) {
			return Promise.resolve(false);
		}
		this.saved.push(reward.id);
		const replacedBy = reward.imagesReplacedBy;
		if (replacedBy !== null) {
			this.imageReplacements.push(replacedBy);
		}
		this.rows.set(reward.id, toState(reward.snapshot(), stored));
		return Promise.resolve(true);
	}
}
