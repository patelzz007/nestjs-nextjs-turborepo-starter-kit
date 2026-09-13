import { HomeLayout } from "fumadocs-ui/layouts/home";

import { baseOptions } from "@/lib/layout.shared";

/** Hub pages (`/`, `/docs`, `/blog`) — top nav only, no sidebar. */
export default function SiteHubLayout({ children }: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
	return <HomeLayout {...baseOptions()}>{children}</HomeLayout>;
}
