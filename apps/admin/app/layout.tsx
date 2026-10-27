import "@workspace/ui/globals.css";
import "./admin-theme.css";

import { QueryProvider } from "@workspace/client/lib/api/query-provider";
import { UrlStateProvider } from "@workspace/client/lib/url-state/url-state-provider";
import { Toaster } from "@workspace/ui/components/toast";
import { cn } from "@workspace/ui/lib/core/utils";
import type { Metadata } from "next";
import { ReduxDevToolsGuard } from "@workspace/ui/components/redux-devtools-guard";
import { bricolageGrotesque } from "@workspace/ui/fonts/bricolage-grotesque";
import { geistMono } from "@workspace/ui/fonts/geist-mono";
import { geistSans } from "@workspace/ui/fonts/geist-sans";

import { serverRenderedSessionOf } from "@workspace/client/lib/contexts/identity/session/load-server-session";

import { AdminClientAuthWrapper } from "@/components/admin-client-auth-wrapper";
import { loadAdminServerSession } from "@/lib/auth-server";
import { AppDocumentShell } from "@workspace/ui/components/app-document-shell";
import { ThemeProvider } from "@workspace/ui/components/theme-provider";
import { UiKitLanguageProvider } from "@workspace/ui/components/ui-kit-labels-provider";
import { PLATFORM_UI_KIT_LANGUAGE } from "@workspace/client/lib/i18n/ui-kit-language";
import { BRAND_NAME } from "@workspace/tokens";

export const metadata: Metadata = {
	title: `${BRAND_NAME} Admin`,
	// Icons come from the file conventions in this folder — icon.svg, favicon.ico, apple-icon.png —
	// all generated from the brand mark by `pnpm tokens:generate` (ADR 040).
};

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>): Promise<React.JSX.Element> {
	// The session the server renders for: the auth store starts from it, so nothing that depends on
	// who is signed in pops in after load. An API outage renders without it (the browser's check retries).
	const serverSession = serverRenderedSessionOf(await loadAdminServerSession());

	return (
		<AppDocumentShell htmlClassName={cn("font-sans antialiased", geistSans.variable, bricolageGrotesque.variable, geistMono.variable)} bodyClassName="admin-app">
			{/* Prevent Redux DevTools extension from serializing React Query / zustand state */}
			<ReduxDevToolsGuard />
			<UiKitLanguageProvider language={PLATFORM_UI_KIT_LANGUAGE}>
				<UrlStateProvider>
					<QueryProvider>
						<AdminClientAuthWrapper serverSession={serverSession}>
							<ThemeProvider>
								{children}
								<Toaster />
							</ThemeProvider>
						</AdminClientAuthWrapper>
					</QueryProvider>
				</UrlStateProvider>
			</UiKitLanguageProvider>
		</AppDocumentShell>
	);
}
