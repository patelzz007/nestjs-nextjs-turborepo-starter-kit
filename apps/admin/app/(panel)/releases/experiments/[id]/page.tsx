import { ExperimentDetailView } from "@/contexts/releases";

export const dynamic = "force-dynamic";

/** `/releases/experiments/[id]` — one experiment: its plan and results (ADR 087). */
export default async function ExperimentPage({ params }: { readonly params: Promise<{ readonly id: string }> }): Promise<React.JSX.Element> {
	const { id } = await params;
	return <ExperimentDetailView experimentId={id} />;
}
