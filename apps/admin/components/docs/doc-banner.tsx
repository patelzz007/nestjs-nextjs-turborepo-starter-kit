import Image from "next/image";

import { BookOpen, Clock, PenLine } from "lucide-react";

import { cn } from "@/lib/utils";
import type { DocContent } from "@/lib/docs";
import { formatIsoDate } from "@/lib/markdown";

/**
 * DocBanner — the cover banner shown at the top of every `/docs/<slug>` page.
 * Purely presentational (rules 9–11): it receives the whole `DocContent` via
 * props and renders whatever cover art the smart layer gave it.
 *
 * ## Cover variant
 * A real photograph (the guide's `coverImage` frontmatter, an absolute https
 * URL) rendered through `next/image` with a **cinematic left-to-right scrim**
 * plus a **bottom vignette**, so the light title stays legible over any photo
 * and the meta row sits on a solid base rather than floating over busy pixels.
 *
 * ## Fallback variant (no cover)
 * A quiet **dotted-paper** texture instead of a flat gray panel: a faint
 * `--color-border` dot grid (theme-token driven, no hardcoded colors) over
 * `bg-card`, finished with a soft primary tint in the top corner. The dots are
 * small and low-opacity — it reads as an intentional editorial texture, not a
 * decorative gradient.
 *
 * ## Typography
 * Deliberately restrained (the "AI-ish" look comes from heavy bold headings,
 * letter-spaced uppercase eyebrows, and high-contrast scrims):
 * - a small **sentence-case pill chip** (never uppercase, never letter-spaced),
 * - a `font-semibold tracking-tight text-balance` title (no `font-bold`),
 * - body-copy description,
 * - a **top-divided meta row** so author / updated / read-time read as a
 *   structured footer rather than a floating list of chips.
 */

export interface DocBannerProps {
	readonly doc: DocContent;
	readonly className?: string;
}

export function DocBanner({ doc, className }: DocBannerProps): React.JSX.Element {
	const coverUrl = doc.coverImage;
	const hasCover = coverUrl !== undefined && coverUrl.length > 0;

	return (
		<header className={cn("relative overflow-hidden rounded-2xl border border-border/60 shadow-sm", className)}>
			{hasCover ? (
				<>
					{/* Real photograph, cropped to cover the banner */}
					<Image src={coverUrl} alt="" fill priority sizes="(min-width: 1024px) 1152px, 100vw" className="object-cover" />
					{/* Legibility scrim — left-to-right darkening so the title stays readable over any photo */}
					<div aria-hidden="true" className="absolute inset-0 bg-linear-to-r from-black/70 via-black/40 to-black/10" />
					{/* Bottom vignette — gives the meta row a solid base instead of floating over busy pixels */}
					<div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-28 bg-linear-to-t from-black/50 to-transparent" />
				</>
			) : (
				<>
					{/* Dotted-paper base — faint token-colored dot grid over the card surface */}
					<div aria-hidden="true" className="absolute inset-0 bg-card" />
					<div
						aria-hidden="true"
						className="absolute inset-0 opacity-40"
						style={{
							backgroundImage: "radial-gradient(circle, var(--color-border) 1px, transparent 1px)",
							backgroundSize: "22px 22px",
						}}
					/>
					{/* Soft primary tint, top-left corner — subtle warmth, not a gradient band */}
					<div aria-hidden="true" className="absolute inset-0 bg-linear-to-br from-primary/[0.07] via-transparent to-transparent" />
				</>
			)}

			<div className="relative px-6 py-10 sm:px-10 sm:py-12">
				{/* Eyebrow — a quiet sentence-case pill chip, not a letter-spaced uppercase label */}
				<span
					className={cn(
						"inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
						hasCover ? "border-white/20 bg-white/10 text-white/90 backdrop-blur-sm" : "border-border bg-background/60 text-muted-foreground",
					)}>
					<span aria-hidden="true" className={cn("size-1.5 rounded-full", hasCover ? "bg-white/70" : "bg-muted-foreground/60")} />
					Guide
				</span>

				<h1 className={cn("mt-4 max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl", hasCover ? "text-white" : "text-foreground")}>{doc.title}</h1>

				{doc.description.length > 0 ? (
					<p className={cn("mt-3 max-w-2xl text-sm leading-relaxed sm:text-[15px]", hasCover ? "text-white/85" : "text-muted-foreground")}>{doc.description}</p>
				) : null}

				{/* Meta — top divider turns the row into a structured footer */}
				<div
					className={cn(
						"mt-6 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t pt-4 text-xs",
						hasCover ? "border-white/15 text-white/75" : "border-border text-muted-foreground",
					)}>
					{doc.author !== undefined ? (
						<span className="inline-flex items-center gap-1.5">
							<PenLine className={cn("size-3.5", hasCover ? "text-white/60" : "text-muted-foreground/70")} />
							{doc.author}
						</span>
					) : null}
					{doc.lastUpdated !== undefined ? (
						<span className="inline-flex items-center gap-1.5">
							<Clock className={cn("size-3.5", hasCover ? "text-white/60" : "text-muted-foreground/70")} />
							Updated {formatIsoDate(doc.lastUpdated)}
						</span>
					) : null}
					<span className="inline-flex items-center gap-1.5">
						<BookOpen className={cn("size-3.5", hasCover ? "text-white/60" : "text-muted-foreground/70")} />
						{doc.readingTimeMinutes} min read
					</span>
				</div>
			</div>
		</header>
	);
}
