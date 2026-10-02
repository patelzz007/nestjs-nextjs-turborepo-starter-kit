import "@workspace/ui/globals.css";
import "./merchant-theme.css";

import { QueryProvider } from "@workspace/client/lib/api/query-provider";
import { MerchantRootProvider } from "@/lib/session/root-provider";
import { cn } from "@workspace/ui/lib/core/utils";
import { AppDocumentShell } from "@workspace/ui/components/app-document-shell";
import { ThemeProvider } from "@workspace/ui/components/theme-provider";
import { Toaster } from "@workspace/ui/components/feedback/toast";
import { bricolageGrotesque } from "@workspace/ui/fonts/bricolage-grotesque";
import { Fira_Sans, JetBrains_Mono, Rubik } from "next/font/google";
import type { Metadata } from "next";
import { ReduxDevToolsGuard } from "@workspace/ui/components/redux-devtools-guard";
import * as React from "react";

const firaSans = Fira_Sans({
	subsets: ["latin"],
	weight: ["400", "500", "600", "700"],
	variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
	subsets: ["latin"],
	variable: "--font-mono",
});

const rubik = Rubik({
	subsets: ["latin"],
	weight: ["400", "500"],
	variable: "--font-sidebar",
});

export const metadata: Metadata = {
	title: "Merchant Portal",
	icons: {
		icon: { url: "/icon.svg", type: "image/svg+xml" },
	},
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
	return (
		<AppDocumentShell
			htmlClassName={cn("font-sans antialiased", firaSans.variable, jetbrainsMono.variable, bricolageGrotesque.variable, rubik.variable)}
			bodyClassName="merchant-app">
			<ReduxDevToolsGuard />
			<QueryProvider>
				<MerchantRootProvider>
					<ThemeProvider>
						{children}
						<Toaster position="top-right" />
					</ThemeProvider>
				</MerchantRootProvider>
			</QueryProvider>
		</AppDocumentShell>
	);
}
