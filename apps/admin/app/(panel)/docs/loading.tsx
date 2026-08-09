/**
 * Docs-aware loading fallback for `/docs/<slug>`. Overrides the generic panel
 * skeleton so navigating between guides shows a banner-shaped pulse + article
 * shimmer lines instead of dashboard cards.
 */
export default function DocsLoading(): React.JSX.Element {
	return (
		<div className="w-full" aria-busy="true" aria-label="Loading guide">
			{/* Banner placeholder */}
			<div className="mb-10 h-56 animate-pulse rounded-2xl border border-border/60 bg-muted/40 sm:h-64" />

			<div className="flex justify-center gap-12">
				<article className="w-full max-w-3xl min-w-0 space-y-4" aria-hidden="true">
					{/* Article shimmer lines — a title, then body-width lines */}
					<div className="h-8 w-3/4 animate-pulse rounded-md bg-muted/60" />
					<div className="space-y-2 pt-4">
						{[0, 1, 2, 3, 4, 5].map((i) => (
							<div key={`line-${String(i)}`} className={`h-4 animate-pulse rounded-sm bg-muted/50 ${i % 3 === 0 ? "w-full" : i % 3 === 1 ? "w-11/12" : "w-5/6"}`} />
						))}
					</div>
					<div className="h-8 w-1/2 animate-pulse rounded-md bg-muted/60 pt-4" />
					<div className="space-y-2 pt-4">
						{[0, 1, 2, 3].map((i) => (
							<div key={`line2-${String(i)}`} className="h-4 animate-pulse rounded-sm bg-muted/50" />
						))}
					</div>
				</article>
			</div>
		</div>
	);
}
