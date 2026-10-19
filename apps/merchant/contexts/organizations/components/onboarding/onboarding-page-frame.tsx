import { ROUTES } from "@/lib/routes";
import { buttonVariants } from "@workspace/ui/components/button";
import { ShellThemeToggle } from "@workspace/ui/components/shell-theme-toggle";
import { cn } from "@workspace/ui/lib/core/utils";
import { Store } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { BRAND_NAME } from "@workspace/tokens";

export interface MerchantOnboardingPageFrameProps {
	readonly children: React.ReactNode;
}

/** The onboarding page's chrome — background, brand header, page title and footer — around the wizard (or its skeleton). */
export function MerchantOnboardingPageFrame({ children }: MerchantOnboardingPageFrameProps): React.JSX.Element {
	return (
		<div className="merchant-onboarding relative min-h-svh overflow-x-hidden bg-background">
			<div className="merchant-grid-bg-subtle pointer-events-none absolute inset-0" aria-hidden="true" />
			<div className="pointer-events-none absolute -top-24 right-0 size-80 rounded-full bg-primary/6 blur-3xl" aria-hidden="true" />
			<div className="pointer-events-none absolute bottom-0 left-0 size-72 rounded-full bg-chart-2/6 blur-3xl" aria-hidden="true" />

			<div className="relative z-10 mx-auto flex min-h-svh w-full max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
				<header className="mb-8 flex items-center justify-between gap-4">
					<div className="flex items-center gap-3">
						<div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
							<Store className="size-5" aria-hidden="true" />
						</div>
						<div>
							<p className="text-sm font-semibold text-foreground">{BRAND_NAME}</p>
							<p className="text-xs text-muted-foreground">Merchant onboarding</p>
						</div>
					</div>
					<div className="flex items-center gap-2">
						<Link href={ROUTES.auth.login} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "hidden sm:inline-flex")}>
							Sign in
						</Link>
						<ShellThemeToggle />
					</div>
				</header>

				<main className="flex flex-1 flex-col overflow-visible pb-8 lg:pt-4">
					<div className="mb-8 space-y-2">
						<h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Set up your store</h1>
						<p className="max-w-2xl text-sm text-muted-foreground">
							Complete your business application, upload verification documents, and create the owner account for this location.
						</p>
					</div>

					{children}
				</main>

				<footer className="pt-4 text-center text-xs text-muted-foreground sm:text-left">
					&copy; {new Date().getFullYear()} {BRAND_NAME}. All rights reserved.
				</footer>
			</div>
		</div>
	);
}
