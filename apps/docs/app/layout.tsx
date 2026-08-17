import "@workspace/ui/globals.css";
import "./global.css";
import "katex/dist/katex.min.css";

import { cn } from "@workspace/ui/lib/utils";
import { Toaster } from "@workspace/ui/components/feedback/sonner";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import type { Metadata } from "next";

import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { RootProvider } from "fumadocs-ui/provider/next";

import { DocsSearchProvider } from "@/components/search-provider";
import { getDocsTree } from "@/lib/docs-tree";
import { baseOptions } from "@/lib/layout.shared";
import { buildSearchMeta } from "@/lib/search-meta";
import { BASE_URL, SITE_NAME, SITE_DESCRIPTION } from "@/lib/site";

/**
 * Space Grotesk — the display/heading face. Geometric but characterful, it
 * gives headings (h1–h4, sidebar brand, landing) a distinctive modern-dev-tool
 * voice while Geist stays the workhorse body font. Replaces the previously
 * unused JetBrains Mono `--font-heading`.
 */
const spaceGroteskHeading = Space_Grotesk({
	subsets: ["latin"],
	variable: "--font-heading",
});

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const fontMono = Geist_Mono({
	subsets: ["latin"],
	variable: "--font-mono",
});

export const metadata: Metadata = {
	metadataBase: new URL(BASE_URL),
	title: {
		default: SITE_NAME,
		template: `%s — ${SITE_NAME}`,
	},
	description: SITE_DESCRIPTION,
	openGraph: {
		siteName: SITE_NAME,
		type: "website",
	},
	icons: {
		icon: { url: "/icon.svg", type: "image/svg+xml" },
	},
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
	return (
		<html lang="en" suppressHydrationWarning className={cn("antialiased", fontMono.variable, "font-sans", geist.variable, spaceGroteskHeading.variable)}>
			<body>
				<RootProvider>
					<DocsSearchProvider meta={buildSearchMeta()}>
						<DocsLayout {...baseOptions()} tree={getDocsTree()}>
							{children}
						</DocsLayout>
					</DocsSearchProvider>
					<Toaster />
				</RootProvider>
			</body>
		</html>
	);
}
