import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/routes";

/**
 * `/rewards` — section index. Rewards open on the review queue. The sidebar
 * lists this URL as a toggle-only parent, so it is only reached by typing or
 * sharing it. Server-side `redirect()` throws during render — no client flash.
 */
export default function RewardsIndexPage(): React.ReactNode {
	redirect(ROUTES.rewards.review);
}
