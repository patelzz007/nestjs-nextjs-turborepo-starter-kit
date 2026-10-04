import DashboardGallery from "./dashboard-gallery";

/**
 * `/` — the admin panel landing page. Top: the real platform overview (sales
 * stat cards and the weekly sales chart from `GET /admin/analytics/sales`,
 * shown with `ANALYTICS.READ`). Below: the UI kit's component gallery, headed
 * as sample content — the heavy sections stay lazy-loaded on the client
 * (`ssr: false` in `dashboard-gallery.tsx`) so they never block first paint.
 */
export default function PanelHomePage(): React.JSX.Element {
	return <DashboardGallery />;
}
