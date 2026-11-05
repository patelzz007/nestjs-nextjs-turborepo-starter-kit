import { UuidParamSchema } from "@workspace/shared";
import { notFound } from "next/navigation";

import { StatusIncidentDetail } from "@/contexts/operations/components/status-page/status-incident-detail";

export const dynamic = "force-dynamic";

/** `/operations/status/[id]` — one status-page incident, its updates, and posting the next (enhancement 4.5). */
export default async function StatusIncidentPage({ params }: { readonly params: Promise<{ readonly id: string }> }): Promise<React.JSX.Element> {
	const parsed = UuidParamSchema.safeParse((await params).id);
	if (!parsed.success) {
		notFound();
	}
	return <StatusIncidentDetail incidentId={parsed.data} />;
}
