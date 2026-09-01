import { Button } from "@workspace/ui/components/form/button";
import { MapPin, Sparkles, Ticket } from "lucide-react";
import Link from "next/link";
import * as React from "react";

/** Marketing hero for the public landing page. */
export function LandingHero(): React.JSX.Element {
	return (
		<section className="relative overflow-hidden border-b border-border/80 bg-linear-to-b from-secondary/50 via-background to-background">
			<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,oklch(from_var(--primary)_l_c_h_/_0.12),transparent)]" />
			<div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
				<div className="mx-auto max-w-3xl text-center">
					<p className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold tracking-wide text-primary uppercase">
						<Sparkles className="size-3.5" aria-hidden="true" />
						KL & Melaka pilot
					</p>
					<h1 className="mt-6 font-[family-name:var(--font-heading)] text-4xl leading-[1.1] font-medium tracking-tight text-foreground sm:text-5xl lg:text-6xl">
						Discover rewards from local merchants you&apos;ll love
					</h1>
					<p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
						Browse cafés, restaurants, and shops near you. Sign in to claim offers, track your wallet, and redeem in-store with QR codes.
					</p>
					<div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
						<Link href="#rewards">
							<Button size="lg" className="min-w-[10rem]">
								Browse rewards
							</Button>
						</Link>
						<Link href="/auth/login?redirect=%2Frewardhub">
							<Button size="lg" variant="outline" className="min-w-[10rem]">
								Sign in to claim
							</Button>
						</Link>
					</div>
				</div>

				<ul className="mx-auto mt-12 grid max-w-3xl gap-4 sm:grid-cols-3">
					<li className="rounded-xl border border-border/80 bg-card px-4 py-4 text-center shadow-xs">
						<MapPin className="mx-auto size-5 text-primary" aria-hidden="true" />
						<p className="mt-2 text-sm font-semibold text-foreground">Near you</p>
						<p className="mt-1 text-xs text-muted-foreground">Filter by city and category</p>
					</li>
					<li className="rounded-xl border border-border/80 bg-card px-4 py-4 text-center shadow-xs">
						<Ticket className="mx-auto size-5 text-primary" aria-hidden="true" />
						<p className="mt-2 text-sm font-semibold text-foreground">Claim in seconds</p>
						<p className="mt-1 text-xs text-muted-foreground">OTP verification, no hassle</p>
					</li>
					<li className="rounded-xl border border-border/80 bg-card px-4 py-4 text-center shadow-xs">
						<Sparkles className="mx-auto size-5 text-primary" aria-hidden="true" />
						<p className="mt-2 text-sm font-semibold text-foreground">Real offers</p>
						<p className="mt-1 text-xs text-muted-foreground">Discounts and free items</p>
					</li>
				</ul>
			</div>
		</section>
	);
}
