import "@workspace/ui/globals.css";
import "./web-theme.css";

import { QueryProvider } from "@workspace/client/lib/api/query-provider";
import { UiPreferencesStoreProvider } from "@workspace/client/lib/features/ui-preferences/facade";
import { cn } from "@workspace/ui/lib/core/utils";
import type { Metadata } from "next";
import { ReduxDevToolsGuard } from "@workspace/ui/components/redux-devtools-guard";
import { bricolageGrotesque } from "@workspace/ui/fonts/bricolage-grotesque";
import { geistMono } from "@workspace/ui/fonts/geist-mono";
import { geistSans } from "@workspace/ui/fonts/geist-sans";

import { WebAuthorizationProvider } from "@/components/auth/web-authorization-provider";
import { WebBreadcrumbProvider } from "@/components/breadcrumb-provider";
import { WebClientAuthWrapper } from "@/components/web-client-auth-wrapper";
import { hasServerSession } from "@/lib/auth/server";
import { loadWebInitialSessionPermissions } from "@/lib/navigation/server";
import { WEB_UI_PREFERENCES_DEVTOOLS_NAME, WEB_UI_PREFERENCES_STORAGE_KEY } from "@/lib/ui-preferences/store-config";
import { AppDocumentShell } from "@workspace/ui/components/app-document-shell";
import { ThemeProvider } from "@workspace/ui/components/theme-provider";
import { UiKitLanguageProvider } from "@workspace/ui/components/ui-kit-labels-provider";
import { PLATFORM_UI_KIT_LANGUAGE } from "@workspace/client/lib/i18n/ui-kit-language";
import { Toaster } from "@workspace/ui/components/toast";
import { ScrollToTop } from "@workspace/ui/components/scroll-to-top";

export const metadata: Metadata = {
	title: "Reward Hub",
	icons: {
		icon: { url: "/icon.svg", type: "image/svg+xml" },
	},
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>): Promise<React.JSX.Element> {
	// One capability source for every page: guests resolve to an empty set.
	const sessionActive = await hasServerSession();
	const initialSessionPermissions = await loadWebInitialSessionPermissions(sessionActive);

	return (
		<AppDocumentShell htmlClassName={cn("font-sans antialiased", geistSans.variable, bricolageGrotesque.variable, geistMono.variable)} bodyClassName="web-app">
			<ReduxDevToolsGuard />
			<UiKitLanguageProvider language={PLATFORM_UI_KIT_LANGUAGE}>
				<QueryProvider>
					<WebClientAuthWrapper sessionActive={sessionActive}>
						<WebAuthorizationProvider sessionActive={sessionActive} initialSessionPermissions={initialSessionPermissions}>
							<ThemeProvider>
								{/* Root, not the /rewardhub shell: the public landing page renders the rewards catalog too. */}
								<UiPreferencesStoreProvider storageKey={WEB_UI_PREFERENCES_STORAGE_KEY} devtoolsName={WEB_UI_PREFERENCES_DEVTOOLS_NAME}>
									<WebBreadcrumbProvider>{children}</WebBreadcrumbProvider>
								</UiPreferencesStoreProvider>
								<Toaster position="top-right" />
								<ScrollToTop />
							</ThemeProvider>
						</WebAuthorizationProvider>
					</WebClientAuthWrapper>
				</QueryProvider>
			</UiKitLanguageProvider>
		</AppDocumentShell>
	);
}
