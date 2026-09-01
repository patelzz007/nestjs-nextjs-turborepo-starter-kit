import { AdminNotFoundContent } from "@/components/common/not-found-content";

/**
 * Global not-found boundary for URLs that match no route anywhere (e.g.
 * `/some-nonsense` while signed out, or malformed auth URLs). Renders
 * full-screen inside the root layout — there is no shell here because the
 * shell belongs to the `(panel)` route group (see `(panel)/not-found.tsx`).
 */
export default function RootNotFound(): React.JSX.Element {
	return <AdminNotFoundContent backHref="/" backLabel="Back to login" message="This page doesn't exist. Head back to the login page or check the address you typed." />;
}
