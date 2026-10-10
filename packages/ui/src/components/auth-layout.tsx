// ============================================
// components/auth-layout.tsx
// Shared split-screen authentication layout.
// Pure presentational — branding copy and form flow in via props/children.
// ============================================
"use client";

import { ArrowLeft } from "lucide-react";
import * as React from "react";

import { cn } from "../lib/core/utils";
import type { UiKitLabelsOverride } from "../lib/labels/ui-kit-labels";
import { BrandMark } from "./brand-mark";
import { buttonVariants, Button } from "./button";
import { ShellThemeToggle } from "./shell-theme-toggle";
import { useUiKitLabels } from "./ui-kit-labels-provider";

/** Copy of the `authLayout` label family (the strings live in the language packs). */
export interface AuthLayoutLabels {
	readonly mobileBack: string;
	readonly toggleThemeAria: string;
	readonly rightsReserved: string;
}

/**
 * Staggered start of the brand panel's ambient glows. `animation-delay` has no
 * Tailwind utility, so the two offsets are named module constants (hoisted —
 * never a new style object per render).
 */
const GLOW_DELAY_SHORT_STYLE: React.CSSProperties = { animationDelay: "0.5s" };
const GLOW_DELAY_LONG_STYLE: React.CSSProperties = { animationDelay: "1s" };

export interface AuthLayoutProps {
	readonly brandName: string;
	readonly tagline: string;
	readonly features: readonly string[];
	readonly title: string;
	readonly subtitle: string;
	readonly children: React.ReactNode;
	/** Per-usage overrides of the `authLayout` family's copy from `UiKitLabelsProvider`. */
	readonly labels?: UiKitLabelsOverride<"authLayout">;
	readonly showBackButton?: boolean;
	readonly backHref?: string;
	readonly backLabel?: string;
	readonly onBack?: () => void;
	readonly copyright?: string;
}

export const AuthLayout = React.forwardRef<HTMLDivElement, AuthLayoutProps>(function AuthLayout(
	{
		brandName,
		tagline,
		features,
		title,
		subtitle,
		children,
		labels: labelsOverride,
		showBackButton = false,
		backHref = "/auth/login",
		backLabel,
		onBack,
		copyright = brandName,
	},
	ref,
): React.JSX.Element {
	const labels = useUiKitLabels("authLayout", labelsOverride);
	return (
		<div ref={ref} data-slot="auth-layout" className="flex min-h-svh bg-background md:h-svh md:max-h-svh md:overflow-hidden">
			<div className="relative hidden flex-col items-center justify-center overflow-y-auto bg-auth-panel md:flex md:min-h-0 md:w-1/2 dark:bg-auth-panel/90">
				<div className="absolute inset-0 bg-linear-to-br from-auth-panel-foreground/3 to-transparent" />

				<div className="absolute top-0 left-0 h-full w-full">
					<div className="absolute top-1/5 left-3/20 size-100 rounded-full bg-auth-panel-foreground/5 blur-3xl motion-safe:animate-pulse" />
					<div
						className="absolute right-1/10 bottom-3/20 size-125 rounded-full bg-auth-panel-foreground/5 blur-3xl motion-safe:animate-pulse"
						style={GLOW_DELAY_SHORT_STYLE}
					/>
					<div className="absolute top-1/2 left-3/10 size-75 rounded-full bg-auth-panel-foreground/3 blur-2xl motion-safe:animate-pulse" style={GLOW_DELAY_LONG_STYLE} />
				</div>

				<div className="absolute top-20 right-20 size-16 rotate-45 border border-auth-panel-foreground/5" />
				<div className="absolute bottom-32 left-16 size-12 rotate-12 border border-auth-panel-foreground/5" />

				<div className="relative z-10 flex flex-col items-center px-8 text-center">
					<div className="relative mb-8">
						<div className="flex size-20 items-center justify-center rounded-2xl bg-linear-to-br from-auth-brand-from to-auth-brand-to shadow-2xl">
							<BrandMark className="size-10 text-auth-panel-foreground" />
						</div>
						<div className="absolute -top-2 -right-2 size-6 rounded-full bg-success motion-safe:animate-pulse" />
					</div>
					<h1 className="mb-4 text-3xl font-bold text-auth-panel-foreground">{brandName}</h1>
					<p className="mb-8 max-w-md leading-relaxed text-auth-panel-muted">{tagline}</p>
					<div className="space-y-3">
						{features.map((feature) => (
							<div key={feature} className="flex items-center gap-3">
								<span className="inline-block size-2 rounded-full bg-success" />
								<span className="text-sm text-auth-panel-muted">{feature}</span>
							</div>
						))}
					</div>
				</div>

				<div className="absolute bottom-6 text-center text-sm text-auth-panel-muted/60">
					&copy; {new Date().getFullYear()} {copyright}. {labels.rightsReserved}
				</div>
			</div>

			<div className="relative flex min-h-svh w-full flex-col bg-background md:min-h-0 md:w-1/2 md:overflow-y-auto">
				<div className="absolute top-0 right-0 size-64 rounded-full bg-linear-to-bl from-info/5 to-transparent blur-3xl dark:from-info/5" />
				<div className="absolute bottom-0 left-0 size-48 rounded-full bg-linear-to-tr from-success/5 to-transparent blur-3xl dark:from-success/5" />

				<div className="relative z-10 flex items-center justify-between p-6">
					<div className="flex items-center gap-3 md:hidden">
						<div className="flex size-8 items-center justify-center rounded-lg bg-linear-to-br from-auth-brand-from to-auth-brand-to">
							<BrandMark className="size-4 text-auth-panel-foreground" />
						</div>
						<span className="text-lg font-semibold text-foreground">{brandName}</span>
					</div>

					{showBackButton ? (
						<div className="md:hidden">
							{onBack ? (
								<Button variant="ghost" size="sm" className="flex items-center gap-2" onClick={onBack}>
									<ArrowLeft className="size-4" />
									{labels.mobileBack}
								</Button>
							) : (
								<a href={backHref} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "flex items-center gap-2")}>
									<ArrowLeft className="size-4" aria-hidden="true" />
									{labels.mobileBack}
								</a>
							)}
						</div>
					) : null}

					<div className="ml-auto">
						<ShellThemeToggle label={labels.toggleThemeAria} />
					</div>
				</div>

				<div className="relative z-10 flex flex-1 flex-col px-6 py-8 md:min-h-0">
					<div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center">
						{showBackButton && backLabel ? (
							<div className="mb-6 hidden md:block">
								{onBack ? (
									<Button variant="ghost" size="sm" className="-ml-2 flex items-center gap-2" onClick={onBack}>
										<ArrowLeft className="size-4" />
										{backLabel}
									</Button>
								) : (
									<a href={backHref} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2 flex items-center gap-2")}>
										<ArrowLeft className="size-4" aria-hidden="true" />
										{backLabel}
									</a>
								)}
							</div>
						) : null}

						<div className="mb-8 text-center">
							<h1 className="mb-2 text-2xl font-bold text-foreground">{title}</h1>
							<p className="text-muted-foreground">{subtitle}</p>
						</div>

						{children}
					</div>
				</div>

				<div className="relative z-10 px-6 py-4 text-center text-sm text-muted-foreground/60 md:hidden">
					&copy; {new Date().getFullYear()} {copyright}. {labels.rightsReserved}
				</div>
			</div>
		</div>
	);
});
