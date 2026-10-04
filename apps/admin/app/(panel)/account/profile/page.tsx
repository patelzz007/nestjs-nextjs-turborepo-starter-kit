import { createAdminServerCaller } from "@/lib/admin-server-api";
import { prefetch, resolvePrefetchedData } from "@/lib/server/prefetch";

import { ProfileView } from "./profile-view";

export const dynamic = "force-dynamic";

/** `/account/profile` — the signed-in admin's own profile: `GET /auth/profile` prefetched on the server, edited with `PATCH /auth/profile`. */
export default async function AccountProfilePage(): Promise<React.JSX.Element> {
	const server = createAdminServerCaller();
	const result = await prefetch({ page: "/account/profile", resource: "own profile" }, () => server.auth.profile.query(undefined));

	return <ProfileView initialProfile={resolvePrefetchedData(result)} />;
}
