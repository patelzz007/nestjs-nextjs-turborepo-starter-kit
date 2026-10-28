import { LoadTestsView } from "@/contexts/operations/components/load-tests-view";

export const dynamic = "force-dynamic";

/** `/operations/load-tests` — start a load test, and every run (ADR 068). */
export default function OperationsLoadTestsPage(): React.JSX.Element {
	return <LoadTestsView />;
}
