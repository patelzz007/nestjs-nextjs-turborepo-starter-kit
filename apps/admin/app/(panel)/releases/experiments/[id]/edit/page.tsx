import { ExperimentFormPage } from "@/contexts/releases";

export const dynamic = "force-dynamic";

/** `/releases/experiments/[id]/edit` — a draft experiment's plan (ADR 087). */
export default async function EditExperimentPage({ params }: { readonly params: Promise<{ readonly id: string }> }): Promise<React.JSX.Element> {
	const { id } = await params;
	return <ExperimentFormPage experimentId={id} />;
}
