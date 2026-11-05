// The Servers screen's query caching (ADR 068). Who may open the screen is the drawer's call: the menu
// shows it to sessions holding SERVER_METRIC LIST (features/navigation/drawer-destinations.ts).

import { OPS_SAMPLE_INTERVAL_MS } from "@workspace/shared";

/** The Servers screen's caching: fresh for one agent interval, refetched on that pace while shown. */
export const OVERVIEW_QUERY_OPTIONS: { readonly staleTime: number; readonly refetchInterval: number; readonly retry: false } = {
	staleTime: OPS_SAMPLE_INTERVAL_MS,
	refetchInterval: OPS_SAMPLE_INTERVAL_MS,
	retry: false,
};
