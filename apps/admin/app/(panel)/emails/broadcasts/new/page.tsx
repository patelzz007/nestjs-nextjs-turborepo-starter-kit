import { NewPlatformBroadcastView } from "@/contexts/notifications/components/platform-broadcast-pages";

export const dynamic = "force-dynamic";

/** `/emails/broadcasts/new` — write a platform notice (CREATE BROADCAST, enforced by the route guard; the API re-checks it). */
export default function NewBroadcastPage(): React.JSX.Element {
	return <NewPlatformBroadcastView />;
}
