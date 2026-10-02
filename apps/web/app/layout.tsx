import "@workspace/ui/globals.css";
import "./web-theme.css";

import { QueryProvider } from "@workspace/client/lib/api/query-provider";
import { cn } from "@workspace/ui/lib/core/utils";
import type { Metadata } from "next";
import { ReduxDevToolsGuard } from "@workspace/ui/components/redux-devtools-guard";
import { bricolageGrotesque } from "@workspace/ui/fonts/bricolage-grotesque";
import { Inter, Playfair_Display, Rubik } from "next/font/google";

import { WebAuthorizationProvider } from "@/components/auth/web-authorization-provider";
import { WebBreadcrumbProvider } from "@/components/breadcrumb-provider";
import { WebClientAuthWrapper } from "@/components/web-client-auth-wrapper";
import { WebSessionBootstrap } from "@/components/web-session-bootstrap";
import { hasServerSession } from "@/lib/auth/server";
import { loadWebInitialSessionPermissions } from "@/lib/navigation/server";
import { AppDocumentShell } from "@workspace/ui/components/app-document-shell";
import { ThemeProvider } from "@workspace/ui/components/theme-provider";
import { Toaster } from "@workspace/ui/components/feedback/toast";
import { ScrollToTop } from "@workspace/ui/components/navigation/scroll-to-top";

const inter = Inter({
	subsets: ["latin"],
	variable: "--font-sans",
});

const playfair = Playfair_Display({
	subsets: ["latin"],
	variable: "--font-heading",
	style: ["italic"],
});

const rubik = Rubik({
	subsets: ["latin"],
	weight: ["400", "500"],
	variable: "--font-sidebar",
});

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
		<AppDocumentShell htmlClassName={cn("font-sans antialiased", inter.variable, playfair.variable, bricolageGrotesque.variable, rubik.variable)} bodyClassName="web-app">
			<ReduxDevToolsGuard />
			<QueryProvider>
				<WebClientAuthWrapper sessionActive={sessionActive}>
					<WebSessionBootstrap />
					<WebAuthorizationProvider sessionActive={sessionActive} initialSessionPermissions={initialSessionPermissions}>
						<ThemeProvider>
							<WebBreadcrumbProvider>{children}</WebBreadcrumbProvider>
							<Toaster position="top-right" />
							<ScrollToTop />
						</ThemeProvider>
					</WebAuthorizationProvider>
				</WebClientAuthWrapper>
			</QueryProvider>
		</AppDocumentShell>
	);
}
