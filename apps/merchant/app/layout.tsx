import "@workspace/ui/globals.css";
import "./merchant-theme.css";

import { QueryProvider } from "@workspace/client/lib/api/query-provider";
import { serverRenderedSessionOf } from "@workspace/client/lib/auth/session/load-server-session";
import { loadMerchantServerSession } from "@/lib/merchant-server-api";
import { MerchantRootProvider } from "@/lib/session/root-provider";
import { cn } from "@workspace/ui/lib/core/utils";
import { AppDocumentShell } from "@workspace/ui/components/app-document-shell";
import { ThemeProvider } from "@workspace/ui/components/theme-provider";
import { UiKitLanguageProvider } from "@workspace/ui/components/ui-kit-labels-provider";
import { PLATFORM_UI_KIT_LANGUAGE } from "@workspace/client/lib/i18n/ui-kit-language";
import { Toaster } from "@workspace/ui/components/toast";
import { bricolageGrotesque } from "@workspace/ui/fonts/bricolage-grotesque";
import { geistMono } from "@workspace/ui/fonts/geist-mono";
import { geistSans } from "@workspace/ui/fonts/geist-sans";
import type { Metadata } from "next";
import { ReduxDevToolsGuard } from "@workspace/ui/components/redux-devtools-guard";
import * as React from "react";

export const metadata: Metadata = {
	title: "Merchant Portal",
	// Icons come from the file conventions in this folder — icon.svg, favicon.ico, apple-icon.png —
	// all generated from the brand mark by `pnpm tokens:generate` (ADR 040).
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { readonly children: React.ReactNode }): Promise<React.JSX.Element> {
	// The session the server renders for: the auth store starts from it, so nothing that depends on
	// who is signed in pops in after load. Without one (a guest, an outage) the browser's check settles it.
	const serverSession = serverRenderedSessionOf(await loadMerchantServerSession());

	return (
		<AppDocumentShell htmlClassName={cn("font-sans antialiased", geistSans.variable, bricolageGrotesque.variable, geistMono.variable)} bodyClassName="merchant-app">
			<ReduxDevToolsGuard />
			<UiKitLanguageProvider language={PLATFORM_UI_KIT_LANGUAGE}>
				<QueryProvider>
					<MerchantRootProvider serverSession={serverSession}>
						<ThemeProvider>
							{children}
							<Toaster position="top-right" />
						</ThemeProvider>
					</MerchantRootProvider>
				</QueryProvider>
			</UiKitLanguageProvider>
		</AppDocumentShell>
	);
}
