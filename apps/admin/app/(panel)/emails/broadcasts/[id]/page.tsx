import { PlatformBroadcastDetailView } from "@/contexts/notifications/components/platform-broadcast-pages";
import { readBroadcastIdParam, type IdRouteParams } from "@/contexts/notifications/lib/route-params";

export const dynamic = "force-dynamic";

/** `/emails/broadcasts/[id]` — one platform notice (READ BROADCAST); a malformed id is the 404 page. */
export default async function BroadcastDetailPage(props: IdRouteParams): Promise<React.JSX.Element> {
	return <PlatformBroadcastDetailView broadcastId={await readBroadcastIdParam(props)} />;
}
