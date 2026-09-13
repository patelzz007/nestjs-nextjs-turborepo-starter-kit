"use client";

import { MerchantOnboardingView } from "@workspace/client/lib/merchant/onboarding/view";
import { Button } from "@workspace/ui/components/form/button";
import { useTheme } from "next-themes";
import Link from "next/link";
import { Moon, Sun } from "lucide-react";
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
			<div className="mx-auto max-w-lg rounded-2xl border border-destructive/20 bg-destructive/5 px-5 py-4 text-center text-sm text-destructive">
				This onboarding link is missing a token. Open the invite email again or ask your platform admin to resend it.
			</div>
		);
	}

	return <MerchantOnboardingView token={token} loginHref="/auth/login" />;
}

export default function MerchantOnboardingPage(): JSX.Element {
	return (
		<div className="merchant-onboarding relative min-h-svh overflow-x-hidden bg-background">
			<div className="merchant-grid-bg pointer-events-none absolute inset-0" aria-hidden="true" />
			<div className="pointer-events-none absolute -top-24 right-0 size-80 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
			<div className="pointer-events-none absolute bottom-0 left-0 size-72 rounded-full bg-chart-2/10 blur-3xl" aria-hidden="true" />

			<div className="relative z-10 mx-auto flex min-h-svh w-full max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
				<header className="mb-8 flex items-center justify-between gap-4">
					<div className="flex items-center gap-3">
						<div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
							<svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
								<path strokeLinecap="round" strokeLinejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
							</svg>
						</div>
						<div>
							<p className="text-sm font-semibold text-foreground">Reward Hub</p>
							<p className="text-xs text-muted-foreground">Merchant onboarding</p>
						</div>
					</div>
					<div className="flex items-center gap-2">
						<Button variant="ghost" size="sm" className="hidden sm:inline-flex" nativeButton={false} render={<Link href="/auth/login" />}>
							Sign in
						</Button>
						<OnboardingThemeToggle />
					</div>
				</header>

				<main className="flex flex-1 flex-col justify-center overflow-visible pb-8">
					<div className="mb-8 space-y-2 text-center lg:text-left">
						<h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Set up your store</h1>
						<p className="mx-auto max-w-2xl text-sm text-muted-foreground lg:mx-0">
							Complete your business application, upload verification documents, and create the owner account for this location.
						</p>
					</div>

					<Suspense
						fallback={
							<div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-border bg-card/80">
								<p className="text-sm text-muted-foreground">Loading…</p>
							</div>
						}>
						<OnboardingContent />
					</Suspense>
				</main>

				<footer className="pt-4 text-center text-xs text-muted-foreground lg:text-left">&copy; {new Date().getFullYear()} Reward Hub. All rights reserved.</footer>
			</div>
		</div>
	);
}
