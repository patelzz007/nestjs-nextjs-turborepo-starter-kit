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
import { nonceProps, readSecurityNonce } from "@workspace/client/lib/security/security-nonce";
import { AppLanguageProvider } from "@workspace/client/lib/i18n/app-language-provider";
import { readRequestLanguage } from "@workspace/client/lib/i18n/request-language";
import { BRAND_NAME } from "@workspace/tokens";

export const metadata: Metadata = {
	title: `${BRAND_NAME} Admin`,
	// Icons come from the file conventions in this folder — icon.svg, favicon.ico, apple-icon.png —
	// all generated from the brand mark by `pnpm tools tokens:generate` (ADR 040).
};

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>): Promise<React.JSX.Element> {
	// The session the server renders for: the auth store starts from it, so nothing that depends on
	// who is signed in pops in after load. An API outage renders without it (the browser's check retries).
	const serverSession = serverRenderedSessionOf(await loadAdminServerSession());
	// The CSP nonce proxy.ts set for this request: next-themes' inline anti-flash script must carry it.
	const nonce = await readSecurityNonce();
	// ADR 076: the `lang` cookie, then the browser's Accept-Language, then English.
	const language = await readRequestLanguage();

	return (
		<AppDocumentShell
			lang={language}
			htmlClassName={cn("font-sans antialiased", geistSans.variable, bricolageGrotesque.variable, geistMono.variable)}
			bodyClassName="admin-app">
			{/* Prevent Redux DevTools extension from serializing React Query / zustand state */}
			<ReduxDevToolsGuard />
			<AppLanguageProvider language={language}>
				<UrlStateProvider>
					<QueryProvider>
						<AdminClientAuthWrapper serverSession={serverSession}>
							<ThemeProvider {...nonceProps(nonce)}>
								{children}
								<Toaster />
							</ThemeProvider>
						</AdminClientAuthWrapper>
					</QueryProvider>
				</UrlStateProvider>
			</AppLanguageProvider>
		</AppDocumentShell>
	);
}
