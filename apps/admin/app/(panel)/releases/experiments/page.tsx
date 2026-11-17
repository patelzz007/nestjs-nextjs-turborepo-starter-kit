import { ExperimentsList } from "@/contexts/releases";

export const dynamic = "force-dynamic";

/** `/releases/experiments` — experiments on dynamic configs (ADR 087). */
export default function ExperimentsPage(): React.JSX.Element {
	return <ExperimentsList />;
}
