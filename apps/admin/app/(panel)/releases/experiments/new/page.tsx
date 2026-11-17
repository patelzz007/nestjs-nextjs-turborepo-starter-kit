import { ExperimentFormPage } from "@/contexts/releases";

export const dynamic = "force-dynamic";

/** `/releases/experiments/new` — plan an experiment, saved as a draft (ADR 087). */
export default function NewExperimentPage(): React.JSX.Element {
	return <ExperimentFormPage experimentId={null} />;
}
