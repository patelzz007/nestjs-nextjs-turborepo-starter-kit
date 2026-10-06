import "@workspace/ui/globals.css";
import "./admin-theme.css";

import { QueryProvider } from "@workspace/client/lib/api/query-provider";
import { Toaster } from "@workspace/ui/components/toast";
import { cn } from "@workspace/ui/lib/core/utils";
import type { Metadata } from "next";
import { ReduxDevToolsGuard } from "@workspace/ui/components/redux-devtools-guard";
import { bricolageGrotesque } from "@workspace/ui/fonts/bricolage-grotesque";
import { geistMono } from "@workspace/ui/fonts/geist-mono";
import { geistSans } from "@workspace/ui/fonts/geist-sans";

import { AdminClientAuthWrapper } from "@/components/admin-client-auth-wrapper";
import { AppDocumentShell } from "@workspace/ui/components/app-document-shell";
import { ThemeProvider } from "@workspace/ui/components/theme-provider";
import { UiKitLanguageProvider } from "@workspace/ui/components/ui-kit-labels-provider";
import { PLATFORM_UI_KIT_LANGUAGE } from "@workspace/client/lib/i18n/ui-kit-language";

export const metadata: Metadata = {
	title: "Reward Hub Admin",
	icons: {
		icon: { url: "/icon.svg", type: "image/svg+xml" },
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>): React.JSX.Element {
	return (
		<AppDocumentShell htmlClassName={cn("font-sans antialiased", geistSans.variable, bricolageGrotesque.variable, geistMono.variable)} bodyClassName="admin-app">
			{/* Prevent Redux DevTools extension from serializing React Query / zustand state */}
			<ReduxDevToolsGuard />
			<UiKitLanguageProvider language={PLATFORM_UI_KIT_LANGUAGE}>
				<QueryProvider>
					<AdminClientAuthWrapper>
						<ThemeProvider>
							{children}
							<Toaster />
						</ThemeProvider>
					</AdminClientAuthWrapper>
				</QueryProvider>
			</UiKitLanguageProvider>
		</AppDocumentShell>
	);
}
