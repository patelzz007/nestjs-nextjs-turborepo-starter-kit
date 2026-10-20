import { DAY_MS } from "@workspace/shared";
import { z } from "zod";

/**
 * Statuses the reward aggregate models. `EXPIRED` and `DISABLED` stay in the Prisma enum but
 * nothing sets them (decision #40): a command load that meets one is corrupt state.
 */
export const RewardLifecycleStatusSchema = z.enum(["DRAFT", "PENDING_REVIEW", "PUBLISHED"]);

export type RewardLifecycleStatus = z.output<typeof RewardLifecycleStatusSchema>;

export const REWARD_LIFECYCLE_STATUSES: readonly RewardLifecycleStatus[] = RewardLifecycleStatusSchema.options;

/** A reward is the consumer offer or the referrer bonus its referrals earn (Prisma `RewardKind`). */
export const RewardKindValueSchema = z.enum(["CONSUMER", "REFERRER"]);

export type RewardKindValue = z.output<typeof RewardKindValueSchema>;

/** Statuses in which a merchant may still change a reward. */
export const EDITABLE_REWARD_STATUSES: readonly RewardLifecycleStatus[] = ["DRAFT", "PENDING_REVIEW"];

/** Days a submitted reward waits for review before it publishes itself. */
const AUTO_PUBLISH_WINDOW_DAYS = 1;

/** The review window: a pending reward auto-publishes this long after it was submitted (24 hours). */
export const AUTO_PUBLISH_WINDOW_MS = AUTO_PUBLISH_WINDOW_DAYS * DAY_MS;

/** Days a referrer bonus lives at most — the same length as the referrer credit claim it backs. */
const REFERRER_REWARD_MAX_TTL_DAYS = 30;

/** Longest life of a referrer child: its expiry is the parent's, capped at this long from now. */
export const REFERRER_REWARD_MAX_TTL_MS = REFERRER_REWARD_MAX_TTL_DAYS * DAY_MS;
