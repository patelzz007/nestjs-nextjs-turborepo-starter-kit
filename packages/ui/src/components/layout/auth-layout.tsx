// ============================================
// components/layout/auth-layout.tsx
// Shared split-screen authentication layout.
//
// Mirrors the classic SaaS auth-page pattern:
//   ┌──────────────┬─────────────────────────────┐
//   │  Brand panel │  Header (logo, toggle)      │
//   │  (hidden on  │  Title / subtitle           │
//   │   < md)      │  <children> (the form)      │
//   │              │  Footer (mobile only)       │
//   └──────────────┴─────────────────────────────┘
//
// Used by BOTH apps (admin + web) so the two login
// experiences stay pixel-identical. Pure presentational:
// branding copy, logo, features and the form itself all
// flow in via props/children — no auth or routing logic.
// ============================================
"use client";

import { ArrowLeft, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import * as React from "react";

import { Button } from "../form/button";

// ── Theme toggle (hydration-safe, mirrors the admin topbar's) ───────────────

/**
 * Light/dark toggle for the auth header. Reads `resolvedTheme` from
 * `next-themes` and flips on click. Hydration-safe: a transparent placeholder
 * keeps the button sized until one frame after mount, then the real icon
 * swaps in — no hydration mismatch, no size jump.
 */
function AuthThemeToggle(): React.JSX.Element {
	const { resolvedTheme, setTheme } = useTheme();
	const [mounted, setMounted] = React.useState(false);

	React.useEffect(() => {
		// rAF-delayed so the state update never runs synchronously inside the
		// effect body (keeps `react-hooks/set-state-in-effect` happy).
		const frame = window.requestAnimationFrame(() => {
			setMounted(true);
		});
		return (): void => {
			window.cancelAnimationFrame(frame);
		};
	}, []);

	const handleToggle = React.useCallback((): void => {
		setTheme(resolvedTheme === "dark" ? "light" : "dark");
	}, [resolvedTheme, setTheme]);

	return (
		<Button variant="ghost" size="icon" onClick={handleToggle} aria-label="Toggle theme" className="rounded-full">
			{mounted ? resolvedTheme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" /> : <Sun className="size-5 opacity-0" aria-hidden="true" />}
		</Button>
	);
}

// ── Props ───────────────────────────────────────────────────────────────────

export interface AuthLayoutProps {
	/** Brand mark rendered in the logo boxes (left panel + mobile header). */
	readonly logo: React.ReactNode;
	/** Brand name, e.g. "LinkHub" / "Admin Panel". */
	readonly brandName: string;
	/** One-liner shown under the brand name on the dark panel. */
	readonly tagline: string;
	/** Bullet points rendered with emerald dots on the dark panel. */
	readonly features: readonly string[];
	/** Heading shown above the form (centered). */
	readonly title: string;
	/** Subtitle shown under the heading (centered). */
	readonly subtitle: string;
	/** The form (or a loading placeholder while auth initializes). */
	readonly children: React.ReactNode;
	/** Show a "Back" affordance (mobile header + desktop above the form). */
	readonly showBackButton?: boolean;
	/** Link target for the back button (used when `onBack` is not provided). */
	readonly backHref?: string;
	/** Label for the desktop back button. @default "Back to sign in" */
	readonly backLabel?: string;
	/** Custom click handler for the back button (overrides the link). */
	readonly onBack?: () => void;
	/** Name used in the © footers. @default brandName */
	readonly copyright?: string;
}

// ── Component ───────────────────────────────────────────────────────────────

export function AuthLayout({
	logo,
	brandName,
	tagline,
	features,
	title,
	subtitle,
	children,
	showBackButton = false,
	backHref = "/auth/login",
	backLabel = "Back to sign in",
	onBack,
	copyright = brandName,
}: AuthLayoutProps): React.JSX.Element {
	return (
		<div className="flex min-h-svh bg-background">
			{/* ── Left: Branding / Visual (desktop only) ───────────────────── */}
			<div className="relative hidden flex-col items-center justify-center overflow-hidden bg-slate-900 md:flex md:w-1/2 dark:bg-slate-950">
				<div className="absolute inset-0 bg-linear-to-br from-white/[0.03] to-transparent" />

				{/* Pulsing gradient blobs */}
				<div className="absolute top-0 left-0 h-full w-full">
					<div className="absolute animate-pulse rounded-full bg-white/5 blur-3xl" style={{ top: "20%", left: "15%", width: "400px", height: "400px" }} />
					<div
						className="absolute animate-pulse rounded-full bg-white/5 blur-3xl"
						style={{ bottom: "15%", right: "10%", width: "500px", height: "500px", animationDelay: "0.5s" }}
					/>
					<div
						className="absolute animate-pulse rounded-full bg-white/[0.03] blur-2xl"
						style={{ top: "50%", left: "30%", width: "300px", height: "300px", animationDelay: "1s" }}
					/>
				</div>

				{/* Geometric accents */}
				<div className="absolute top-20 right-20 size-16 rotate-45 border border-white/5" />
				<div className="absolute bottom-32 left-16 size-12 rotate-12 border border-white/5" />

				{/* Logo + branding */}
				<div className="relative z-10 flex flex-col items-center px-8 text-center">
					<div className="relative mb-8">
						<div className="flex size-20 items-center justify-center rounded-2xl bg-linear-to-br from-blue-600 to-blue-700 shadow-2xl">
							<span className="[&_svg]:size-10 [&_svg]:text-white">{logo}</span>
						</div>
						<div className="absolute -top-2 -right-2 size-6 animate-pulse rounded-full bg-emerald-500" />
					</div>
					<h1 className="mb-4 text-3xl font-bold text-white">{brandName}</h1>
					<p className="mb-8 max-w-md leading-relaxed text-slate-400">{tagline}</p>
					<div className="space-y-3">
						{features.map((feature) => (
							<div key={feature} className="flex items-center gap-3">
								<span className="inline-block size-2 rounded-full bg-emerald-500" />
								<span className="text-sm text-slate-400">{feature}</span>
							</div>
						))}
					</div>
				</div>

				{/* Footer (desktop) */}
				<div className="absolute bottom-6 text-center text-sm text-slate-500/60">
					&copy; {new Date().getFullYear()} {copyright}. All rights reserved.
				</div>
			</div>

			{/* ── Right: Auth forms ────────────────────────────────────────── */}
			<div className="relative flex w-full flex-col bg-background md:w-1/2">
				{/* Subtle decorative elements for the form side */}
				<div className="absolute top-0 right-0 size-64 rounded-full bg-linear-to-bl from-blue-500/5 to-transparent blur-3xl dark:from-blue-500/5" />
				<div className="absolute bottom-0 left-0 size-48 rounded-full bg-linear-to-tr from-emerald-500/5 to-transparent blur-3xl dark:from-emerald-500/5" />

				{/* Header row */}
				<div className="relative z-10 flex items-center justify-between p-6">
					{/* Mobile logo */}
					<div className="flex items-center gap-3 md:hidden">
						<div className="flex size-8 items-center justify-center rounded-lg bg-linear-to-br from-blue-600 to-blue-700">
							<span className="[&_svg]:size-4 [&_svg]:text-white">{logo}</span>
						</div>
						<span className="text-lg font-semibold text-foreground">{brandName}</span>
					</div>

					{/* Back button for mobile */}
					{showBackButton ? (
						<div className="md:hidden">
							{onBack ? (
								<Button variant="ghost" size="sm" className="flex items-center gap-2" onClick={onBack}>
									<ArrowLeft className="size-4" />
									Back
								</Button>
							) : (
								<Button variant="ghost" size="sm" className="flex items-center gap-2" render={<a href={backHref} />}>
									<ArrowLeft className="size-4" />
									Back
								</Button>
							)}
						</div>
					) : null}

					{/* Theme toggle */}
					<div className="ml-auto">
						<AuthThemeToggle />
					</div>
				</div>

				{/* Centered form area */}
				<div className="relative z-10 flex flex-1 items-center justify-center p-6">
					<div className="w-full max-w-md">
						{/* Back button for desktop */}
						{showBackButton ? (
							<div className="mb-6 hidden md:block">
								{onBack ? (
									<Button variant="ghost" size="sm" className="-ml-2 flex items-center gap-2" onClick={onBack}>
										<ArrowLeft className="size-4" />
										{backLabel}
									</Button>
								) : (
									<Button variant="ghost" size="sm" className="-ml-2 flex items-center gap-2" render={<a href={backHref} />}>
										<ArrowLeft className="size-4" />
										{backLabel}
									</Button>
								)}
							</div>
						) : null}

						{/* Dynamic title and subtitle */}
						<div className="mb-8 text-center">
							<h1 className="mb-2 text-2xl font-bold text-foreground">{title}</h1>
							<p className="text-muted-foreground">{subtitle}</p>
						</div>

						{children}
					</div>
				</div>

				{/* Footer (mobile only) */}
				<div className="relative z-10 px-6 py-4 text-center text-sm text-muted-foreground/60 md:hidden">
					&copy; {new Date().getFullYear()} {copyright}. All rights reserved.
				</div>
			</div>
		</div>
	);
}
