import "@workspace/ui/globals.css";
import "./web-theme.css";

import { QueryProvider } from "@workspace/client/lib/api/query-provider";
import { UrlStateProvider } from "@workspace/client/lib/url-state/url-state-provider";
import { UiPreferencesStoreProvider } from "@workspace/client/lib/features/ui-preferences/facade";
import { cn } from "@workspace/ui/lib/core/utils";
import type { Metadata } from "next";
import { ReduxDevToolsGuard } from "@workspace/ui/components/redux-devtools-guard";
import { bricolageGrotesque } from "@workspace/ui/fonts/bricolage-grotesque";
import { geistMono } from "@workspace/ui/fonts/geist-mono";
import { geistSans } from "@workspace/ui/fonts/geist-sans";

import { WebAuthorizationProvider } from "@/contexts/identity/components/web-authorization-provider";
import { WebBreadcrumbProvider } from "@/components/breadcrumb-provider";
import { WebClientAuthWrapper } from "@/contexts/identity/components/web-client-auth-wrapper";
import { hasServerSession } from "@/contexts/identity/lib/server";
import { loadWebServerSession } from "@/contexts/identity/lib/server-session";
import { WEB_UI_PREFERENCES_DEVTOOLS_NAME, WEB_UI_PREFERENCES_STORAGE_KEY } from "@/lib/ui-preferences/store-config";
import { AppDocumentShell } from "@workspace/ui/components/app-document-shell";
import { ThemeProvider } from "@workspace/ui/components/theme-provider";
import { nonceProps, readSecurityNonce } from "@workspace/client/lib/security/security-nonce";
import { AppLanguageProvider } from "@workspace/client/lib/i18n/app-language-provider";
import { readRequestLanguage } from "@workspace/client/lib/i18n/request-language";
import { Toaster } from "@workspace/ui/components/toast";
import { ScrollToTop } from "@workspace/ui/components/scroll-to-top";
import { BRAND_NAME } from "@workspace/tokens";

export const metadata: Metadata = {
	title: BRAND_NAME,
	// Icons come from the file conventions in this folder — icon.svg, favicon.ico, apple-icon.png —
	// all generated from the brand mark by `pnpm tools tokens:generate` (ADR 040).
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>): Promise<React.JSX.Element> {
	// The session the server renders for: the auth store and the capability source both start from
	// it, so nothing that depends on who is signed in pops in after load. Guests have none.
	const sessionActive = await hasServerSession();
	const serverSession = await loadWebServerSession(sessionActive);
	// The CSP nonce proxy.ts set for this request: next-themes' inline anti-flash script must carry it.
	const nonce = await readSecurityNonce();
	// ADR 076: the `lang` cookie, then the browser's Accept-Language, then English.
	const language = await readRequestLanguage();

	return (
		<AppDocumentShell lang={language} htmlClassName={cn("font-sans antialiased", geistSans.variable, bricolageGrotesque.variable, geistMono.variable)} bodyClassName="web-app">
			<ReduxDevToolsGuard />
			<AppLanguageProvider language={language}>
				<UrlStateProvider>
					<QueryProvider>
						<WebClientAuthWrapper sessionActive={sessionActive} serverSession={serverSession}>
							<WebAuthorizationProvider sessionActive={sessionActive} initialSessionPermissions={serverSession?.permissions}>
								<ThemeProvider {...nonceProps(nonce)}>
									{/* Root, not the /dashboard shell: the public landing page renders the rewards catalog too. */}
									<UiPreferencesStoreProvider storageKey={WEB_UI_PREFERENCES_STORAGE_KEY} devtoolsName={WEB_UI_PREFERENCES_DEVTOOLS_NAME}>
										<WebBreadcrumbProvider>{children}</WebBreadcrumbProvider>
									</UiPreferencesStoreProvider>
									<Toaster position="top-right" />
									<ScrollToTop />
								</ThemeProvider>
							</WebAuthorizationProvider>
						</WebClientAuthWrapper>
					</QueryProvider>
				</UrlStateProvider>
			</AppLanguageProvider>
		</AppDocumentShell>
	);
}
