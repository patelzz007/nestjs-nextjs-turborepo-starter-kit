import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/routes";

/**
 * `/catalog` — section index. The catalog opens on Products. The sidebar
 * lists this URL as a toggle-only parent, so it is only reached by typing or
 * sharing it. Server-side `redirect()` throws during render — no client flash.
 */
export default function CatalogIndexPage(): React.ReactNode {
	redirect(ROUTES.catalog.products.list);
}
