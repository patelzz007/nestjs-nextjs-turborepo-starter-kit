import { sql } from "../../sql";
import type { SecurityFunction } from "../security-function";

/** Rewards helpers the reward policies call. */
export const REWARD_FUNCTIONS: readonly SecurityFunction[] = [
	{
		name: "app_holds_reward_claim",
		signature: "app_holds_reward_claim(text)",
		description:
			"The session's user holds a (non-deleted) claim on the reward, so the reward stays readable to them after it stops being public. " +
			"SECURITY DEFINER so it reads claims without re-entering that table's policies (one of which reads rewards: a policy cycle).",
		definition: sql`CREATE OR REPLACE FUNCTION app_holds_reward_claim("rewardId" text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT app_current_user_id() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public."RewardClaim" c
      WHERE c."rewardId" = app_holds_reward_claim."rewardId"
        AND c."userId" = app_current_user_id()
        AND c."isDeleted" = false
    );
$$;`,
	},
];
