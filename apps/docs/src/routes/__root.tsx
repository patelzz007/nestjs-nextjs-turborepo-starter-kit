import { createRootRouteWithContext, HeadContent, Outlet, Scripts, useRouterState, type ErrorComponentProps } from "@tanstack/react-router";
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";
import { UiKitLabelsProvider } from "@workspace/ui/components/ui-kit-labels-provider";
import { UI_KIT_LABELS_EN } from "@workspace/ui/lib/labels/en";
import { useEffect, type ReactElement, type ReactNode } from "react";

import { initCodeTheme } from "@/browser/code-theme";
import { followSystemTheme, THEME_BOOTSTRAP_SCRIPT } from "@/browser/theme";
import { IconSprite } from "@/components/icon-sprite";
import { NotFoundPage } from "@/components/not-found-page";
import { SearchProvider } from "@/components/search-provider";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { guideIdFromPath } from "@/lib/navigation";
import { SITE_NAME } from "@/lib/site";
import type { RouterContext } from "@/router";
import { fetchNav } from "@/server/functions";
import appCss from "@/styles/app.css?url";

export const Route = createRootRouteWithContext<RouterContext>()({
	head: () => ({
		meta: [{ charSet: "utf-8" }, { name: "viewport", content: "width=device-width, initial-scale=1" }, { name: "theme-color", content: "#f1f4f9" }],
		links: [
			{ rel: "stylesheet", href: appCss },
			// Generated from the brand mark by `pnpm tools tokens:generate` (ADR 040).
			{ rel: "icon", href: "/favicon.ico", sizes: "32x32" },
			{ rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
			{ rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
			{ rel: "alternate", type: "application/rss+xml", title: `${SITE_NAME} blog`, href: "/feed.xml" },
			{ rel: "sitemap", href: "/sitemap.xml" },
		],
	}),
	loader: () => fetchNav(),
	shellComponent: RootDocument,
	component: RootLayout,
	notFoundComponent: NotFoundPage,
	errorComponent: RouteError,
});

/**
 * The HTML document. The theme is applied before first paint, so `<html>`'s classes differ from the server's;
 * extensions add attributes to `<body>`. `suppressHydrationWarning` exempts only those two elements' own
 * attributes — any real mismatch below them is still reported.
 */
function RootDocument({ children }: { readonly children: ReactNode }): ReactElement {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<HeadContent />
				<script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
			</head>
			{/* Browser extensions add attributes to <body> before React loads (cz-shortcut-listen, …); only its own attributes are exempt. */}
			<body suppressHydrationWarning>
				{children}
				<Scripts />
			</body>
		</html>
	);
}

/** Every page: skip link, header, the page, footer; search and the kit's labels around them all. */
function RootLayout(): ReactElement {
	const sections = Route.useLoaderData();
	const pathname = useRouterState({ select: (state) => state.location.pathname });

	useEffect((): (() => void) => initCodeTheme(), []);
	useEffect((): (() => void) => followSystemTheme(), []);

	return (
		<UiKitLabelsProvider labels={UI_KIT_LABELS_EN}>
			<SearchProvider>
				<a
					href="#main-content"
					className="sr-only rounded-md bg-background px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:ring-2 focus:ring-ring">
					Skip to content
				</a>
				<IconSprite names={sections.flatMap((section) => section.items.map((item) => item.icon))} />
				<div className="flex min-h-dvh flex-col">
					<SiteHeader sections={sections} activeGuideId={guideIdFromPath(pathname)} />
					<div className="flex-1">
						<Outlet />
					</div>
					<SiteFooter />
				</div>
			</SearchProvider>
		</UiKitLabelsProvider>
	);
}

/** A page that failed to load: say so, and how to recover. */
function RouteError({ error }: ErrorComponentProps): ReactElement {
	const detail = error instanceof Error ? error.message : "Something went wrong while loading it.";
	return (
		<main id="main-content" className="mx-auto max-w-2xl px-4 py-16 md:px-6">
			<Alert variant="destructive">
				<AlertTitle>This page could not be shown</AlertTitle>
				<AlertDescription>{detail} Reload the page to try again; if it keeps failing, the guide may have moved, so use search (⌘K) to find it.</AlertDescription>
			</Alert>
		</main>
	);
}
