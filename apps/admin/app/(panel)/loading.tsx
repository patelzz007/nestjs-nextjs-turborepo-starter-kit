/**
 * Loading fallback for every authenticated panel route. Shown while the page
 * segment streams in — since the `(panel)` layout keeps the sidebar/topbar
 * mounted, this replaces only the content area, so navigation stays SPA-like.
 */
export default function PanelLoading(): React.JSX.Element {
	return (
		<div className="flex flex-col gap-4 py-6">
			<div className="h-6 w-48 animate-pulse rounded-md bg-muted" />
			<div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
				{[0, 1, 2, 3].map((i) => (
					<div key={`card-${String(i)}`} className="h-32 animate-pulse rounded-lg border bg-card" />
				))}
			</div>
			<div className="h-80 animate-pulse rounded-lg border bg-card" />
		</div>
	);
}
