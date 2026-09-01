import DashboardGallery from "./dashboard-gallery";

/**
 * `/` — the admin panel landing page (component gallery / overview). Server
 * wrapper: the heavy showcase sections below the fold stay lazy-loaded on the
 * client (`ssr: false` in `dashboard-gallery.tsx` is deliberate — recharts,
 * react-table, dnd-kit etc. should not block first paint), but the shell
 * (jump-to nav, stat cards) is server-rendered in the initial HTML.
 */
export default function PanelHomePage(): React.JSX.Element {
	return <DashboardGallery />;
}
