import "@workspace/ui/globals.css";

import { QueryProvider } from "@workspace/client/lib/api/query-provider";
import { Toaster } from "@workspace/ui/components/feedback/toast";
import { cn } from "@workspace/ui/lib/utils";
import type { Metadata } from "next";
import { Geist, Geist_Mono, JetBrains_Mono } from "next/font/google";

import { ClientAuthWrapper } from "@workspace/client/lib/auth/client-auth-wrapper";
import { ThemeProvider } from "@workspace/ui/components/theme-provider";

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
					<ClientAuthWrapper
						// Isolated cookie names + X-Client-Type: admin so web and admin
						// sessions never share cookies on the same host.
						cookieNames={{ accessToken: "adminAccessToken", refreshToken: "adminRefreshToken" }}
						clientType="admin">
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
