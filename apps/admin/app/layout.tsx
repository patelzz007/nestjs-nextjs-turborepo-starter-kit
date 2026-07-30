import type { Metadata } from "next"
import { Geist, Geist_Mono, JetBrains_Mono } from "next/font/google"

import "@workspace/ui/globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@workspace/ui/lib/auth"
import { QueryProvider } from "@workspace/ui/lib/query-provider"
import { cn } from "@workspace/ui/lib/utils"
import { ClientAuthWrapper } from "@/components/client-auth-wrapper"

const jetbrainsMonoHeading = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-heading",
})

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  icons: {
    icon: { url: "/icon.svg", type: "image/svg+xml" },
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        geist.variable,
        jetbrainsMonoHeading.variable,
      )}
    >
      <body>
        <QueryProvider>
          <ClientAuthWrapper>
            <ThemeProvider>{children}</ThemeProvider>
          </ClientAuthWrapper>
        </QueryProvider>
      </body>
    </html>
  )
}
