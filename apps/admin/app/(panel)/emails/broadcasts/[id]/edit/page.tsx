import { EditPlatformBroadcastView } from "@/contexts/notifications/components/platform-broadcast-pages";
import { readBroadcastIdParam, type IdRouteParams } from "@/contexts/notifications/lib/route-params";

export const dynamic = "force-dynamic";

/** `/emails/broadcasts/[id]/edit` — a platform draft in the composer (READ + UPDATE BROADCAST); a malformed id is the 404 page. */
export default async function EditBroadcastPage(props: IdRouteParams): Promise<React.JSX.Element> {
	return <EditPlatformBroadcastView broadcastId={await readBroadcastIdParam(props)} />;
}
