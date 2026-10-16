import { Badge } from "@workspace/ui/components/badge";
import { IconTile } from "@workspace/ui/components/icon-tile";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type * as React from "react";

import { GALLERY_EXAMPLE_COUNTS } from "@/components/component-gallery/examples/examples-manifest";
import {
	EXAMPLE_ONLY_KEYS,
	GALLERY_CATALOG_ORDER,
	GALLERY_ENTRIES,
	GALLERY_FAMILIES,
	NOT_SHOWN_COMPONENTS,
	type GalleryComponentKey,
	type GalleryFamily,
} from "@/components/component-gallery/gallery-catalog";
import { GALLERY_FAMILY_META } from "@/components/component-gallery/gallery-family-meta";
import { formatCount } from "@/lib/format/numbers";
import { ROUTES } from "@/lib/routes";

/** A component's worked examples (0 when it has none). */
function exampleCountOf(key: GalleryComponentKey): number {
	return GALLERY_EXAMPLE_COUNTS.get(GALLERY_ENTRIES[key].id) ?? 0;
}

const TOTAL_EXAMPLES = [...GALLERY_EXAMPLE_COUNTS.values()].reduce((sum: number, count: number): number => sum + count, 0);

interface GalleryStat {
	readonly label: string;
	readonly value: number;
}

const GALLERY_STATS: readonly GalleryStat[] = [
	{ label: "Components", value: GALLERY_CATALOG_ORDER.length },
	{ label: "Worked examples", value: TOTAL_EXAMPLES },
	{ label: "Families", value: GALLERY_FAMILIES.length },
];

interface ComponentCardProps {
	readonly componentKey: GalleryComponentKey;
}

/** One component's card: its name, what it is for, and what its page holds. */
function ComponentCard({ componentKey }: ComponentCardProps): React.JSX.Element {
	const entry = GALLERY_ENTRIES[componentKey];
	const examples = exampleCountOf(componentKey);
	return (
		<li className="flex">
			<Link
				href={ROUTES.components.component(entry.slug)}
				className="group/card flex w-full flex-col gap-3 rounded-xl border bg-card p-5 text-card-foreground transition-colors outline-none hover:border-foreground/20 hover:bg-accent/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
				<div className="flex items-start justify-between gap-3">
					<h3 className="font-mono text-sm font-semibold text-foreground">{entry.name}</h3>
					<ArrowRight
						aria-hidden="true"
						className="size-4 shrink-0 text-muted-foreground transition-transform group-hover/card:translate-x-0.5 group-hover/card:text-primary motion-reduce:transition-none"
					/>
				</div>
				<p className="line-clamp-2 flex-1 text-sm text-muted-foreground">{entry.description}</p>
				<div className="flex flex-wrap items-center gap-1.5">
					{EXAMPLE_ONLY_KEYS.has(componentKey) ? null : (
						<Badge variant="success-light" size="sm" radius="full">
							Live demo
						</Badge>
					)}
					{examples > 0 ? (
						<Badge variant="secondary" size="sm" radius="full">
							{examples === 1 ? "1 example" : `${formatCount(examples)} examples`}
						</Badge>
					) : null}
				</div>
			</Link>
		</li>
	);
}

interface FamilySectionProps {
	readonly family: GalleryFamily;
}

function FamilySection({ family }: FamilySectionProps): React.JSX.Element {
	const meta = GALLERY_FAMILY_META[family.id];
	const Icon = meta.icon;
	const titleId = `${family.id}-title`;
	return (
		<section id={family.id} aria-labelledby={titleId} className="flex scroll-mt-6 flex-col gap-4">
			<header className="flex items-center gap-3">
				<IconTile tone={meta.tone} size="md">
					<Icon aria-hidden="true" />
				</IconTile>
				<div className="flex min-w-0 flex-col">
					<div className="flex items-center gap-2">
						<h2 id={titleId} className="text-lg font-semibold tracking-tight text-foreground">
							{family.title}
						</h2>
						<span className="text-sm text-muted-foreground tabular-nums">{family.keys.length}</span>
					</div>
					<p className="text-sm text-muted-foreground">{meta.summary}</p>
				</div>
			</header>
			<ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
				{family.keys.map((key: GalleryComponentKey): React.JSX.Element => (
					<ComponentCard key={key} componentKey={key} />
				))}
			</ul>
		</section>
	);
}

/**
 * `/components`: the gallery's front page — what the kit holds, then every
 * component by family, each a card linking to its own page. Server-rendered
 * links and counts only (examples-manifest.ts): no demo or example code loads
 * here, so the page is light however large the kit grows.
 */
export function GalleryOverview(): React.JSX.Element {
	return (
		<div className="flex flex-col gap-12">
			<header className="relative overflow-hidden rounded-2xl border bg-card p-6 text-card-foreground shadow-xs sm:p-10">
				<div
					aria-hidden="true"
					className="pointer-events-none absolute inset-0 bg-[radial-gradient(var(--border)_1px,transparent_1px)] [mask-image:linear-gradient(to_left,black,transparent_70%)] bg-size-[18px_18px]"
				/>
				<div className="relative flex max-w-2xl flex-col gap-4">
					<Badge variant="primary-light" radius="full" className="self-start">
						@workspace/ui
					</Badge>
					<div className="flex flex-col gap-2">
						<h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Components</h1>
						<p className="text-base text-muted-foreground">
							The UI kit&apos;s low-level building blocks. Every component has its own page with a live demo of its variants, sizes and states, and worked examples you can
							use. Sample content only — nothing here reads platform data.
						</p>
					</div>
					<dl className="mt-2 flex flex-wrap gap-x-10 gap-y-4">
						{GALLERY_STATS.map((stat: GalleryStat): React.JSX.Element => (
							<div key={stat.label} className="flex flex-col-reverse gap-0.5">
								<dt className="text-sm text-muted-foreground">{stat.label}</dt>
								<dd className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">{formatCount(stat.value)}</dd>
							</div>
						))}
					</dl>
				</div>
			</header>
			{GALLERY_FAMILIES.map((family: GalleryFamily): React.JSX.Element => (
				<FamilySection key={family.id} family={family} />
			))}
			<section aria-labelledby="components-not-shown-title" className="flex flex-col gap-2 rounded-xl border border-dashed p-5">
				<h2 id="components-not-shown-title" className="text-base font-semibold tracking-tight">
					Not shown here
				</h2>
				<p className="text-sm text-muted-foreground">
					App-shell and infrastructure components are mounted once by the layouts, and composite surfaces are built from the primitives above, so they have no page of their
					own:
				</p>
				<ul className="ms-4 list-disc text-sm text-muted-foreground">
					{NOT_SHOWN_COMPONENTS.map((group: string): React.JSX.Element => (
						<li key={group}>{group}</li>
					))}
				</ul>
			</section>
		</div>
	);
}
