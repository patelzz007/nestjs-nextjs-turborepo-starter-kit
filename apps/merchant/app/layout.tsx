import "@workspace/ui/globals.css";
import "./merchant-theme.css";

import { QueryProvider } from "@workspace/client/lib/api/query-provider";
import { MerchantRootProvider } from "@/lib/merchant-root-provider";
import { readMerchantOrgIdCookie } from "@/lib/merchant-server-api";
import { cn } from "@workspace/ui/lib/utils";
import { ThemeProvider } from "@workspace/ui/components/theme-provider";
import { Toaster } from "@workspace/ui/components/feedback/toast";
import { bricolageGrotesque } from "@workspace/ui/fonts/bricolage-grotesque";
import { Fira_Sans, JetBrains_Mono } from "next/font/google";
import type { Metadata } from "next";
import Script from "next/script";
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

export const metadata: Metadata = {
	title: "Merchant Portal",
	icons: {
		icon: { url: "/icon.svg", type: "image/svg+xml" },
	},
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { readonly children: React.ReactNode }): Promise<React.JSX.Element> {
	const initialMerchantOrgId = await readMerchantOrgIdCookie();

	return (
		<html lang="en" suppressHydrationWarning className={cn("font-sans antialiased", firaSans.variable, jetbrainsMono.variable, bricolageGrotesque.variable)}>
			<body className="merchant-app">
				<Script
					id="redux-devtools-guard"
					strategy="beforeInteractive"
					dangerouslySetInnerHTML={{
						__html: "window.__REDUX_DEVTOOLS_EXTENSION__ = window.__REDUX_DEVTOOLS_EXTENSION__ || { connect: function(){return {}} };",
					}}
				/>
				<QueryProvider>
					<MerchantRootProvider initialMerchantOrgId={initialMerchantOrgId}>
						<ThemeProvider>
							{children}
							<Toaster position="top-right" />
						</ThemeProvider>
					</MerchantRootProvider>
				</QueryProvider>
			</body>
		</html>
	);
}
