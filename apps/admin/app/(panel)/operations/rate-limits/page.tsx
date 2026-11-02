import { RateLimitsView } from "@/contexts/operations/components/rate-limits-view";

export const dynamic = "force-dynamic";

/** `/operations/rate-limits` — policies, refusals, tenant overrides and penalties (ADR 071). */
export default function OperationsRateLimitsPage(): React.JSX.Element {
	return <RateLimitsView />;
}
