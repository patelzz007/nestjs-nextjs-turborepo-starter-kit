import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/routes";

/**
 * `/operations` — section index. The console opens on Servers. The sidebar
 * lists this URL as a toggle-only parent, so it is only reached by typing or
 * sharing it. Server-side `redirect()` throws during render — no client flash.
 */
export default function OperationsIndexPage(): React.ReactNode {
	redirect(ROUTES.operations.servers);
}
