import DashboardGallery from "./dashboard-gallery";

/**
 * `/` — the admin panel landing page. Top: the real platform overview (sales
 * stat cards and the weekly sales chart from `GET /admin/analytics/sales`,
 * shown with `ANALYTICS.READ`). Below: the UI kit's component gallery, headed
 * as sample content — the heavy sections stay lazy-loaded on the client
 * (`ssr: false` in `dashboard-gallery.tsx`) so they never block first paint.
 *
 * It sits in the `(home)` route group (no URL segment) so that its own
 * `loading.tsx` draws the dashboard's skeleton: a `loading.tsx` wraps its
 * segment's page AND every child segment, so `(panel)/loading.tsx` must stay
 * the generic fallback for the rest of the panel.
 */
export default function PanelHomePage(): React.JSX.Element {
	return <DashboardGallery />;
}
