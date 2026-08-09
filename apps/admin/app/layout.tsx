import "@workspace/ui/globals.css";
import "@/app/docs.css";

import { QueryProvider } from "@workspace/client/lib/query-provider";
import { Toaster } from "@workspace/ui/components/sonner";
import { cn } from "@workspace/ui/lib/utils";
import type { Metadata } from "next";
import { Geist, Geist_Mono, JetBrains_Mono } from "next/font/google";

import { ClientAuthWrapper } from "@/components/common/client-auth-wrapper";
import { ThemeProvider } from "@/components/common/theme-provider";

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
							{children}
							<Toaster />
						</ThemeProvider>
					</ClientAuthWrapper>
				</QueryProvider>
			</body>
		</html>
	);
}
