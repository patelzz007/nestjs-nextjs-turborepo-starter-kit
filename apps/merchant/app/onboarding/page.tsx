"use client";

import { ROUTES } from "@/lib/routes";
import { MerchantOnboardingView, MerchantOnboardingViewSkeleton } from "@workspace/client/lib/merchant/onboarding/view";
import { cn } from "@workspace/ui/lib/core/utils";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import { useTheme } from "next-themes";
import Link from "next/link";
import { Moon, Store, Sun } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState, type JSX } from "react";

function OnboardingThemeToggle(): JSX.Element {
	const { resolvedTheme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);

	useEffect((): (() => void) => {
		const frame = window.requestAnimationFrame((): void => {
			setMounted(true);
		});
		return (): void => {
			window.cancelAnimationFrame(frame);
		};
	}, []);

	const handleToggle = useCallback((): void => {
		setTheme(resolvedTheme === "dark" ? "light" : "dark");
	}, [resolvedTheme, setTheme]);

	return (
		<Button variant="ghost" size="icon" onClick={handleToggle} aria-label="Toggle theme" className="rounded-full">
			{mounted ? resolvedTheme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" /> : <Sun className="size-5 opacity-0" aria-hidden="true" />}
		</Button>
	);
}

function OnboardingContent(): JSX.Element {
	const searchParams = useSearchParams();
	const token = searchParams.get("token");

	if (token === null || token.length === 0) {
		return (
			<div className="mx-auto w-full max-w-lg overflow-hidden rounded-2xl border border-destructive/20 bg-card/90 shadow-xs backdrop-blur-sm">
				<div className="h-1 bg-destructive/40" aria-hidden="true" />
				<div className="space-y-2 p-6 sm:p-8">
					<h2 className="text-xl font-semibold tracking-tight">Invalid onboarding link</h2>
					<p className="text-sm text-muted-foreground">This onboarding link is missing a token. Open the invite email again or ask your platform admin to resend it.</p>
				</div>
			</div>
		);
	}

	return <MerchantOnboardingView token={token} loginHref={ROUTES.auth.login} />;
}

export default function MerchantOnboardingPage(): JSX.Element {
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
							<p className="text-sm font-semibold text-foreground">Reward Hub</p>
							<p className="text-xs text-muted-foreground">Merchant onboarding</p>
						</div>
					</div>
					<div className="flex items-center gap-2">
						<Link href={ROUTES.auth.login} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "hidden sm:inline-flex")}>
							Sign in
						</Link>
						<OnboardingThemeToggle />
					</div>
				</header>

				<main className="flex flex-1 flex-col overflow-visible pb-8 lg:pt-4">
					<div className="mb-8 space-y-2">
						<h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Set up your store</h1>
						<p className="max-w-2xl text-sm text-muted-foreground">
							Complete your business application, upload verification documents, and create the owner account for this location.
						</p>
					</div>

					<Suspense fallback={<MerchantOnboardingViewSkeleton />}>
						<OnboardingContent />
					</Suspense>
				</main>

				<footer className="pt-4 text-center text-xs text-muted-foreground sm:text-left">&copy; {new Date().getFullYear()} Reward Hub. All rights reserved.</footer>
			</div>
		</div>
	);
}
