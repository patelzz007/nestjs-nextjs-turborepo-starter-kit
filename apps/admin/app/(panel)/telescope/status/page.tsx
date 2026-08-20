import { createServerCaller } from "@workspace/client/lib/api/server-api";

import TelescopeStatusView from "./status-dashboard";

export const dynamic = "force-dynamic";

/** `/telescope/status` — fetches the capture config/health snapshot + webhook deliveries server-side. */
export default async function TelescopeStatusPage(): Promise<React.JSX.Element> {
	const server = createServerCaller();
	const [statusData, deliveriesData] = await Promise.all([server.telescope.status.query(undefined), server.telescope.webhookDeliveries.query(undefined)]);

	return <TelescopeStatusView initialStatus={statusData} initialDeliveries={deliveriesData} />;
}
