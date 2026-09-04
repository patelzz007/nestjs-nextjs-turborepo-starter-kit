import "@workspace/ui/globals.css";
import "./web-theme.css";

import { QueryProvider } from "@workspace/client/lib/api/query-provider";
import { cn } from "@workspace/ui/lib/utils";
import type { Metadata } from "next";
import { ReduxDevToolsGuard } from "@workspace/ui/components/redux-devtools-guard";
import { bricolageGrotesque } from "@workspace/ui/fonts/bricolage-grotesque";
import { Inter, Playfair_Display } from "next/font/google";

import { WebBreadcrumbProvider } from "@/components/breadcrumb-provider";
import { WebClientAuthWrapper } from "@/components/web-client-auth-wrapper";
import { WebSessionBootstrap } from "@/components/web-session-bootstrap";
import { ThemeProvider } from "@workspace/ui/components/theme-provider";
import { ScrollToTop } from "@workspace/ui/components/navigation/scroll-to-top";
import { validateWebEnv } from "@workspace/shared/runtime/index";

const inter = Inter({
	subsets: ["latin"],
	variable: "--font-sans",
});

const playfair = Playfair_Display({
	subsets: ["latin"],
	variable: "--font-heading",
	style: ["italic"],
});

export const metadata: Metadata = {
	title: "Reward Hub",
	icons: {
		icon: { url: "/icon.svg", type: "image/svg+xml" },
	},
};

export const dynamic = "force-dynamic";

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>): React.JSX.Element {
	if (typeof window === "undefined") {
		const webEnvResult = validateWebEnv(process.env);
		if (!webEnvResult.success) {
			console.error("❌ Web app environment validation failed:");
			console.error(webEnvResult.error);
			throw new Error("Web app environment validation failed");
		}
		console.log("✅ Web app environment variables validated successfully");
	}

	return (
		<html lang="en" suppressHydrationWarning className={cn("font-sans antialiased", inter.variable, playfair.variable, bricolageGrotesque.variable)}>
			<body className="web-app">
				<ReduxDevToolsGuard />
				<QueryProvider>
					<WebClientAuthWrapper>
						<WebSessionBootstrap />
						<ThemeProvider>
							<WebBreadcrumbProvider>{children}</WebBreadcrumbProvider>
							<ScrollToTop />
						</ThemeProvider>
					</WebClientAuthWrapper>
				</QueryProvider>
			</body>
		</html>
	);
}
