"use client";

import { Badge, type BadgeVariant } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/empty";
import { Label } from "@workspace/ui/components/label";
import { Progress, ProgressLabel, ProgressValue } from "@workspace/ui/components/progress";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { Spinner } from "@workspace/ui/components/spinner";
import { StatusBadge, type StatusTone } from "@workspace/ui/components/status-badge";
import { Switch } from "@workspace/ui/components/switch";
import { CircleCheck, Inbox, Minus, Plus } from "lucide-react";
import * as React from "react";
import { z } from "zod";

import { GALLERY_ENTRIES } from "@/components/component-gallery/gallery-catalog";
import { ComponentSection, DemoRow, DemoSurface, ExampleOnlySections } from "@/components/component-gallery/gallery-section";
import { AlertShowcase } from "@/components/showcase/alert-showcase";
import { ToastShowcase } from "@/components/showcase/toast-showcase";

// ── Progress ────────────────────────────────────────────────────────────────

const PROGRESS_MIN = 0;
const PROGRESS_MAX = 100;
/** How far each button press moves the demo progress. */
const PROGRESS_STEP = 10;
const INITIAL_PROGRESS = 40;
/** Fixed values of the static size and error examples. */
const SMALL_EXAMPLE_PROGRESS = 65;
const FAILED_AT_PROGRESS = 80;

function ProgressDemo(): React.JSX.Element {
	const [progress, setProgress] = React.useState<number>(INITIAL_PROGRESS);

	const handleDecrease = React.useCallback((): void => {
		setProgress((current) => Math.max(PROGRESS_MIN, current - PROGRESS_STEP));
	}, []);

	const handleIncrease = React.useCallback((): void => {
		setProgress((current) => Math.min(PROGRESS_MAX, current + PROGRESS_STEP));
	}, []);

	return (
		<DemoSurface>
			<div className="flex max-w-md flex-col gap-6">
				<div className="flex flex-col gap-3">
					<Progress value={progress}>
						<ProgressLabel>Uploading catalog</ProgressLabel>
						<ProgressValue className="ms-auto" />
					</Progress>
					<div className="flex gap-2">
						<Button type="button" variant="outline" size="icon-sm" aria-label="Decrease the progress" onClick={handleDecrease} disabled={progress === PROGRESS_MIN}>
							<Minus />
						</Button>
						<Button type="button" variant="outline" size="icon-sm" aria-label="Increase the progress" onClick={handleIncrease} disabled={progress === PROGRESS_MAX}>
							<Plus />
						</Button>
					</div>
				</div>
				<Progress value={null} aria-label="Indeterminate progress">
					<ProgressLabel>Indeterminate (value null)</ProgressLabel>
				</Progress>
				<Progress value={SMALL_EXAMPLE_PROGRESS} size="sm" aria-label="Small progress">
					<ProgressLabel>Size sm</ProgressLabel>
				</Progress>
				<Progress value={FAILED_AT_PROGRESS} state="error" aria-label="Failed upload">
					<ProgressLabel>Error state</ProgressLabel>
					<ProgressValue className="ms-auto" />
				</Progress>
			</div>
		</DemoSurface>
	);
}

// ── Spinner ─────────────────────────────────────────────────────────────────

function SpinnerDemo(): React.JSX.Element {
	return (
		<DemoSurface>
			<DemoRow label="Variants">
				<Spinner ariaLabel="Loading (current colour)" />
				<Spinner variant="muted" ariaLabel="Loading (muted)" />
				<Spinner variant="primary" ariaLabel="Loading (primary)" />
				<Spinner state="error" ariaLabel="Loading (error tone)" />
			</DemoRow>
			<DemoRow label="Sizes">
				<Spinner size="sm" ariaLabel="Loading (small)" />
				<Spinner ariaLabel="Loading (default)" />
				<Spinner size="lg" ariaLabel="Loading (large)" />
			</DemoRow>
			<DemoRow label="Inside a button (decorative)">
				<Button type="button" variant="outline" disabled>
					<Spinner aria-hidden />
					Syncing…
				</Button>
			</DemoRow>
		</DemoSurface>
	);
}

// ── Skeleton ────────────────────────────────────────────────────────────────

function SkeletonDemo(): React.JSX.Element {
	const [isLoaded, setIsLoaded] = React.useState<boolean>(false);

	return (
		<DemoSurface>
			<div className="flex items-center gap-2">
				<Switch id="gallery-skeleton-loaded" checked={isLoaded} onCheckedChange={setIsLoaded} />
				<Label htmlFor="gallery-skeleton-loaded">Content loaded</Label>
			</div>
			{isLoaded ? (
				<div className="flex max-w-sm items-center gap-3">
					<div className="flex size-12 items-center justify-center rounded-full bg-muted text-sm font-medium">AL</div>
					<div className="flex flex-col">
						<p className="text-sm font-medium">Ada Lovelace</p>
						<p className="text-xs text-muted-foreground">ada@example.com</p>
					</div>
				</div>
			) : (
				<div aria-hidden="true" className="flex max-w-sm items-center gap-3">
					<Skeleton variant="circular" className="size-12" />
					<div className="flex flex-1 flex-col gap-2">
						<Skeleton variant="text" className="h-4 w-3/5" />
						<Skeleton variant="text" className="h-3 w-4/5" />
					</div>
				</div>
			)}
			<DemoRow label="Variants and sizes" className="flex-col items-stretch">
				<div aria-hidden="true" className="flex max-w-sm flex-col gap-2">
					<Skeleton className="h-20 w-full" />
					<Skeleton size="sm" variant="text" className="w-1/2" />
					<Skeleton size="lg" className="w-2/3" />
					<Skeleton state="error" className="h-8 w-full" />
				</div>
			</DemoRow>
		</DemoSurface>
	);
}

// ── Empty ───────────────────────────────────────────────────────────────────

function EmptyDemo(): React.JSX.Element {
	const [hasInvited, setHasInvited] = React.useState<boolean>(false);

	const handleInvite = React.useCallback((): void => {
		setHasInvited(true);
	}, []);

	const handleReset = React.useCallback((): void => {
		setHasInvited(false);
	}, []);

	return (
		<DemoSurface>
			<Empty className="border">
				<EmptyHeader>
					<EmptyMedia variant="icon">{hasInvited ? <CircleCheck /> : <Inbox />}</EmptyMedia>
					<EmptyTitle>{hasInvited ? "Invite sent" : "No merchants yet"}</EmptyTitle>
					<EmptyDescription>{hasInvited ? "The merchant will appear here once they accept." : "Invite your first merchant to start issuing rewards."}</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					{hasInvited ? (
						<Button type="button" variant="outline" onClick={handleReset}>
							Reset the demo
						</Button>
					) : (
						<Button type="button" onClick={handleInvite}>
							Invite a merchant
						</Button>
					)}
				</EmptyContent>
			</Empty>
		</DemoSurface>
	);
}

// ── Badge ───────────────────────────────────────────────────────────────────

const BADGE_SOLID_VARIANTS: readonly BadgeVariant[] = ["default", "secondary", "outline", "info", "success", "warning", "destructive", "invert"];
const BADGE_LIGHT_VARIANTS: readonly BadgeVariant[] = ["primary-light", "info-light", "success-light", "warning-light", "destructive-light", "invert-light"];
const BADGE_OUTLINE_VARIANTS: readonly BadgeVariant[] = ["primary-outline", "info-outline", "success-outline", "warning-outline", "destructive-outline", "invert-outline"];
const BADGE_TONE_VARIANTS: readonly BadgeVariant[] = ["green", "blue", "yellow", "red", "orange", "teal", "violet"];

const BadgeSizeSchema = z.enum(["xs", "sm", "default", "lg", "xl"]);
const BADGE_SIZES: readonly z.output<typeof BadgeSizeSchema>[] = BadgeSizeSchema.options;

interface BadgeVariantRowProps {
	readonly label: string;
	readonly variants: readonly BadgeVariant[];
}

function BadgeVariantRow({ label, variants }: BadgeVariantRowProps): React.JSX.Element {
	return (
		<DemoRow label={label}>
			{variants.map((variant) => (
				<Badge key={variant} variant={variant}>
					{variant}
				</Badge>
			))}
		</DemoRow>
	);
}

function BadgeDemo(): React.JSX.Element {
	return (
		<DemoSurface>
			<BadgeVariantRow label="Solid" variants={BADGE_SOLID_VARIANTS} />
			<BadgeVariantRow label="Light" variants={BADGE_LIGHT_VARIANTS} />
			<BadgeVariantRow label="Outline" variants={BADGE_OUTLINE_VARIANTS} />
			<BadgeVariantRow label="Tones" variants={BADGE_TONE_VARIANTS} />
			<DemoRow label="Sizes and radius">
				{BADGE_SIZES.map((size) => (
					<Badge key={size} size={size} variant="secondary">
						{size}
					</Badge>
				))}
				<Badge radius="full" variant="success">
					Pill
				</Badge>
			</DemoRow>
		</DemoSurface>
	);
}

// ── Status badge ────────────────────────────────────────────────────────────

interface StatusExample {
	readonly tone: StatusTone;
	readonly label: string;
}

const STATUS_EXAMPLES: readonly StatusExample[] = [
	{ tone: "success", label: "Active" },
	{ tone: "warning", label: "Pending review" },
	{ tone: "danger", label: "Suspended" },
	{ tone: "info", label: "Invited" },
	{ tone: "neutral", label: "Draft" },
	{ tone: "muted", label: "Archived" },
];

function StatusBadgeDemo(): React.JSX.Element {
	return (
		<DemoSurface>
			<DemoRow label="Tones (the caller maps its own statuses to a tone)">
				{STATUS_EXAMPLES.map((example) => (
					<StatusBadge key={example.tone} tone={example.tone}>
						{example.label}
					</StatusBadge>
				))}
			</DemoRow>
		</DemoSurface>
	);
}

/** Feedback & status: messages, progress and placeholders. Smart: owns every demo's state. */
export function FeedbackStatusFamily(): React.JSX.Element {
	return (
		<>
			<ComponentSection entry={GALLERY_ENTRIES.alert} height="h-[400px]">
				<AlertShowcase />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.toast} height="h-56">
				<ToastShowcase />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.progress} height="h-72">
				<ProgressDemo />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.spinner} height="h-56">
				<SpinnerDemo />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.skeleton} height="h-72">
				<SkeletonDemo />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.empty} height="h-72">
				<EmptyDemo />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.badge} height="h-72">
				<BadgeDemo />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.statusBadge} height="h-24">
				<StatusBadgeDemo />
			</ComponentSection>
			<ExampleOnlySections familyId="family-feedback-status" />
		</>
	);
}
