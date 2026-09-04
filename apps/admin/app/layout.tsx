import "@workspace/ui/globals.css";
import "./admin-theme.css";

import { QueryProvider } from "@workspace/client/lib/api/query-provider";
import { Toaster } from "@workspace/ui/components/feedback/toast";
import { cn } from "@workspace/ui/lib/utils";
import type { Metadata } from "next";
import { ReduxDevToolsGuard } from "@workspace/ui/components/redux-devtools-guard";
import { bricolageGrotesque } from "@workspace/ui/fonts/bricolage-grotesque";
import { Geist, Geist_Mono, JetBrains_Mono } from "next/font/google";

import { ClientAuthWrapper } from "@workspace/client/lib/auth/client-auth-wrapper";
import { ThemeProvider } from "@workspace/ui/components/theme-provider";
import { validateAdminEnv } from "@workspace/shared/runtime/index";

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
	// Validate environment variables on client-side (for NEXT_PUBLIC_ vars)
	if (typeof window === "undefined") {
		// Server-side validation
		const adminEnvResult = validateAdminEnv(process.env);
		if (!adminEnvResult.success) {
			console.error("❌ Admin app environment validation failed:");
			console.error(adminEnvResult.error);
			// In Next.js, we can throw to prevent rendering during SSR
			throw new Error("Admin app environment validation failed");
		}
		console.log("✅ Admin app environment variables validated successfully");
	}

	return (
		<html
			lang="en"
			suppressHydrationWarning
			className={cn("antialiased", fontMono.variable, "font-sans", geist.variable, jetbrainsMonoHeading.variable, bricolageGrotesque.variable)}>
			<body className="admin-app">
				{/* Prevent Redux DevTools extension from serializing React Query / zustand state */}
				<ReduxDevToolsGuard />
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
