import "@workspace/ui/globals.css";

import { QueryProvider } from "@workspace/client/lib/query-provider";
import { cn } from "@workspace/ui/lib/utils";
import type { Metadata } from "next";
import { Geist, Geist_Mono, JetBrains_Mono } from "next/font/google";

import { WebBreadcrumbProvider } from "@/components/breadcrumb-provider";
import { ClientAuthWrapper } from "@/components/client-auth-wrapper";
import { ThemeProvider } from "@/components/theme-provider";
import { ScrollToTop } from "@workspace/ui/components/scroll-to-top";

const jetbrainsMonoHeading = JetBrains_Mono({
	subsets: ["latin"],
	variable: "--font-heading",
});

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const fontMono = Geist_Mono({
	subsets: ["latin"],
	variable: "--font-mono",
});

export const metadata: Metadata = {
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
		<html lang="en" suppressHydrationWarning className={cn("antialiased", fontMono.variable, "font-sans", geist.variable, jetbrainsMonoHeading.variable)}>
			<body>
				<QueryProvider>
					<ClientAuthWrapper>
						<ThemeProvider>
							<WebBreadcrumbProvider>{children}</WebBreadcrumbProvider>
							{/* The web app scrolls the window — walk-up from here finds `window`. */}
							<ScrollToTop />
						</ThemeProvider>
					</ClientAuthWrapper>
				</QueryProvider>
			</body>
		</html>
	);
}
