import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/routes";

/** `/releases` — the section's index opens the feature flags. Server-side `redirect()` throws during render — no client flash. */
export default function ReleasesIndexPage(): React.ReactNode {
	redirect(ROUTES.releases.flags);
}
