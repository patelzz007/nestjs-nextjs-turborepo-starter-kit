import { createServerCaller } from "@workspace/client/lib/api/server-api";

import TelescopeRequestDetailView from "./request-detail";

export const dynamic = "force-dynamic";

/** `/telescope/requests/[id]` — request drill-down. */
export default async function TelescopeRequestDetailPage({ params }: { readonly params: Promise<{ readonly id: string }> }): Promise<React.JSX.Element> {
	const { id } = await params;
	const server = createServerCaller();
	const data = await server.telescope.requestDetail.query({ id });

	return <TelescopeRequestDetailView initialEnvelope={data} />;
}
