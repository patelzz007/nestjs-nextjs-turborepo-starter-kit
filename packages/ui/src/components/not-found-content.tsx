import * as React from "react";

/**
 * Shared, presentational 404 content — used by both the admin panel and the
 * web app's not-found pages. Purely rendering (rules 9–11): every string and
 * the "back" link element arrive via props, so nothing here is app-specific
 * or hardcoded.
 */
export interface NotFoundContentProps {
	readonly code?: string;
	readonly title?: string;
	readonly message?: string;
	/** The app-supplied "back" link element (e.g. a Next.js `Link`). */
	readonly backLink: React.ReactNode;
}

export function NotFoundContent({
	code = "404",
	title = "Page not found",
	message = "The page you're looking for doesn't exist or may have been moved.",
	backLink,
}: NotFoundContentProps): React.JSX.Element {
	return (
		<div className="flex min-h-[50vh] flex-col items-center justify-center gap-5 px-6 py-16 text-center">
			<p className="font-mono text-6xl font-semibold tracking-tight text-muted-foreground/25">{code}</p>
			<div className="space-y-1.5">
				<h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
				<p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">{message}</p>
			</div>
			{backLink}
		</div>
	);
}
