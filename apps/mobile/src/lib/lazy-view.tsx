// ============================================
// lib/lazy-view.tsx - a view whose module loads the first time it is drawn
// ============================================
// A native app ships one bundle, so splitting does not shrink the download;
// what it saves is JavaScript EVALUATED at launch (decision #60,
// docs/architecture/ddd-cqrs-migration-plan.md §19.5). `lazyView` wraps a heavy
// view — the markdown body and its parser, the till's camera views, the PDF
// viewer — in React.lazy + Suspense: its module is evaluated the first time the
// view renders, and until then the caller's skeleton holds its place. Once
// loaded, every later render draws the view at once.

import * as React from "react";

/** What React.lazy resolves to: the loaded view as the module's default component. */
interface LoadedView<Props extends object> {
	readonly default: React.ComponentType<Props>;
}

/**
 * The view that `load` resolves to, drawn behind `Fallback` until it has loaded.
 * `load` is a dynamic `import()` of the heavy module, picking its export:
 * `async () => (await import("./markdown-body")).MarkdownBody`.
 */
export function lazyView<Props extends object>(load: () => Promise<React.ComponentType<Props>>, Fallback: React.ComponentType): React.ComponentType<Props> {
	const LoadedView = React.lazy(async (): Promise<LoadedView<Props>> => ({ default: await load() }));
	function LazyView(props: Props): React.JSX.Element {
		return (
			<React.Suspense fallback={<Fallback />}>
				<LoadedView {...props} />
			</React.Suspense>
		);
	}
	return LazyView;
}
