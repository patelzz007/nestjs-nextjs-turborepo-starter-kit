"use client";

import { useAuth } from "@workspace/client/lib/contexts/identity";
import {
	BROADCAST_CHOICE_SURFACE_CLASS,
	BroadcastComposerForm,
	FieldError,
	type BroadcastAudienceSlot,
	type BroadcastComposerCopy,
	type BroadcastSaveIntent,
} from "@workspace/client/lib/features/broadcasts/broadcast-composer-form";
import type { BroadcastDraftResult } from "@workspace/client/lib/features/broadcasts/broadcast-draft";
import { PlatformBroadcastCategorySchema, type BroadcastAudiencePreview, type BroadcastDraftInput } from "@workspace/shared";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { DatePicker } from "@workspace/ui/components/date-picker";
import { Label } from "@workspace/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group";
import { useDebouncedValue } from "@workspace/ui/hooks/use-debounced-value";
import * as React from "react";

import {
	needsSecondApproval,
	PLATFORM_CATEGORY_LABELS,
	PLATFORM_SURFACE_LABELS,
	PLATFORM_TENANT_STATES_LABELS,
	PlatformSurfaceSchema,
	PlatformTenantStatesFilterSchema,
	toPlatformAudience,
	toPlatformBroadcastDraft,
	type PlatformBroadcastValues,
	type PlatformSurface,
} from "@/contexts/notifications/lib/platform-broadcast-composer";
import { useBroadcastPictureUpload, type BroadcastPictureTarget } from "@workspace/client/lib/features/broadcasts/use-broadcast-picture-upload";

/** Platform notices take the staff member's own picture uploads. */
const PLATFORM_PICTURES: BroadcastPictureTarget = { kind: "platform" };

const PLATFORM_COPY: BroadcastComposerCopy = {
	titlePlaceholder: "e.g. Planned maintenance on Sunday night",
	bodyPlaceholder: "Write the notice. Add a link or a button people can tap.",
	audienceTitle: "Who gets it",
	audienceDescription: "Pick the people by the app they use. Each person still gets it only the ways their settings allow.",
	deliveryDescription: "Product news respects each person's settings and quiet hours; nobody gets it by SMS.",
	atTimeHint: "In your time zone.",
	recipientLocalLabel: "At a set time for each person",
	recipientLocalHint: "9:00 means 9:00 wherever they are.",
	previewHeading: "What people see",
};

/** How long the live count waits after the last change. */
const PREVIEW_DEBOUNCE_MS = 400;

const LEFT_OUT_LABELS: Readonly<Record<BroadcastAudiencePreview["leftOut"][number]["reason"], string>> = {
	"no-consent": "opted out",
	banned: "banned",
	left: "left",
	staff: "staff",
	deleted: "closed their account",
};

export interface PlatformBroadcastComposerProps {
	readonly senderTimeZone: string;
	readonly initialValues: PlatformBroadcastValues;
	/** Whether this staff member may send (`PUBLISH BROADCAST`); otherwise drafts only. */
	readonly canSend: boolean;
	readonly isSaving: boolean;
	readonly savingIntent: BroadcastSaveIntent | undefined;
	readonly onSave: (draft: BroadcastDraftInput, intent: BroadcastSaveIntent) => void;
	readonly cancel: React.ReactNode;
}

/**
 * The platform's broadcast composer (ADR 073): the shared composer, with platform staff's own audience —
 * people by the app they use, narrowed by sign-up date and, for merchant staff, their store's state — and
 * the kind of notice. A notice to everyone, unnarrowed, waits for a second person's approval.
 */
export function PlatformBroadcastComposer({
	senderTimeZone,
	initialValues,
	canSend,
	isSaving,
	savingIntent,
	onSave,
	cancel,
}: PlatformBroadcastComposerProps): React.JSX.Element {
	const toDraft = React.useCallback(
		(values: PlatformBroadcastValues, now: number): BroadcastDraftResult => toPlatformBroadcastDraft(values, senderTimeZone, now),
		[senderTimeZone],
	);
	// The platform's picture (enhancement 5.4): the staff member's own PLATFORM_BROADCAST_IMAGE upload.
	const picture = useBroadcastPictureUpload(PLATFORM_PICTURES);
	const renderAudience = React.useCallback(
		(slot: BroadcastAudienceSlot<PlatformBroadcastValues>): React.ReactNode => <PlatformAudienceFields slot={slot} senderTimeZone={senderTimeZone} />,
		[senderTimeZone],
	);
	return (
		<BroadcastComposerForm<PlatformBroadcastValues>
			initialValues={initialValues}
			copy={PLATFORM_COPY}
			toDraft={toDraft}
			renderAudience={renderAudience}
			sendDisabledReason={canSend ? null : "You can write drafts; someone who may send broadcasts sends them."}
			isSaving={isSaving}
			savingIntent={savingIntent}
			onSave={onSave}
			cancel={cancel}
			picture={picture}
		/>
	);
}

/** Who gets the notice: the apps, a sign-up date, the stores' state, and the kind of notice. */
function PlatformAudienceFields({
	slot,
	senderTimeZone,
}: {
	readonly slot: BroadcastAudienceSlot<PlatformBroadcastValues>;
	readonly senderTimeZone: string;
}): React.JSX.Element {
	const { values, onChange, error, disabled } = slot;
	const handleSurface = React.useCallback(
		(surface: PlatformSurface, checked: boolean): void => {
			onChange({
				surfaces: checked
					? PlatformSurfaceSchema.options.filter((option) => option === surface || values.surfaces.includes(option))
					: values.surfaces.filter((option) => option !== surface),
			});
		},
		[onChange, values.surfaces],
	);
	const handleNarrowBySignup = React.useCallback(
		(checked: boolean): void => {
			onChange({ signedUpAfter: checked ? values.sendDate : "" });
		},
		[onChange, values.sendDate],
	);
	const handleSignedUpAfter = React.useCallback(
		(signedUpAfter: string): void => {
			onChange({ signedUpAfter });
		},
		[onChange],
	);
	const handleTenantStates = React.useCallback(
		(value: string): void => {
			const parsed = PlatformTenantStatesFilterSchema.safeParse(value);
			if (parsed.success) {
				onChange({ tenantStates: parsed.data });
			}
		},
		[onChange],
	);
	const handleCategory = React.useCallback(
		(value: string): void => {
			const parsed = PlatformBroadcastCategorySchema.safeParse(value);
			if (parsed.success) {
				onChange({ category: parsed.data });
			}
		},
		[onChange],
	);

	return (
		<div className="flex flex-col gap-5">
			<fieldset className="flex flex-col gap-2">
				<legend className="mb-2 text-sm font-medium text-foreground">People who use</legend>
				<div className="grid gap-2 sm:grid-cols-3">
					{PlatformSurfaceSchema.options.map((surface): React.JSX.Element => (
						<SurfaceCheckbox key={surface} surface={surface} checked={values.surfaces.includes(surface)} onToggle={handleSurface} disabled={disabled} />
					))}
				</div>
				<FieldError field="audience" message={error} />
			</fieldset>

			{values.surfaces.includes("MERCHANT") ? (
				<div className="flex flex-col gap-2">
					<p id="tenant-states-label" className="text-sm font-medium text-foreground">
						Merchant staff of
					</p>
					<RadioGroup
						aria-labelledby="tenant-states-label"
						value={values.tenantStates}
						onValueChange={handleTenantStates}
						disabled={disabled}
						className="grid gap-2 sm:grid-cols-3">
						{PlatformTenantStatesFilterSchema.options.map((option): React.JSX.Element => (
							<Label key={option} className={BROADCAST_CHOICE_SURFACE_CLASS}>
								<RadioGroupItem value={option} className="mt-0.5" />
								<span className="text-sm text-foreground">{PLATFORM_TENANT_STATES_LABELS[option]}</span>
							</Label>
						))}
					</RadioGroup>
				</div>
			) : null}

			<div className="flex flex-col gap-2">
				<Label className="flex items-center gap-2 font-normal">
					<Checkbox checked={values.signedUpAfter !== ""} onCheckedChange={handleNarrowBySignup} disabled={disabled} />
					<span className="text-sm text-foreground">Only people who signed up on or after a date</span>
				</Label>
				{values.signedUpAfter === "" ? null : (
					<DatePicker
						id="signedUpAfter"
						value={values.signedUpAfter}
						onValueChange={handleSignedUpAfter}
						disabled={disabled}
						placeholder="Pick a date"
						aria-label="Signed up on or after"
						className="sm:w-64"
					/>
				)}
			</div>

			<div className="flex flex-col gap-2">
				<p id="category-label" className="text-sm font-medium text-foreground">
					Kind of notice
				</p>
				<RadioGroup aria-labelledby="category-label" value={values.category} onValueChange={handleCategory} disabled={disabled} className="grid gap-2 sm:grid-cols-2">
					{PlatformBroadcastCategorySchema.options.map((category): React.JSX.Element => (
						<Label key={category} className={BROADCAST_CHOICE_SURFACE_CLASS}>
							<RadioGroupItem value={category} className="mt-0.5" />
							<span className="flex flex-col gap-0.5">
								<span className="text-sm font-medium text-foreground">{PLATFORM_CATEGORY_LABELS[category].label}</span>
								<span className="text-xs text-muted-foreground">{PLATFORM_CATEGORY_LABELS[category].hint}</span>
							</span>
						</Label>
					))}
				</RadioGroup>
			</div>

			<AudienceCount values={values} senderTimeZone={senderTimeZone} />
		</div>
	);
}

interface SurfaceCheckboxProps {
	readonly surface: PlatformSurface;
	readonly checked: boolean;
	readonly onToggle: (surface: PlatformSurface, checked: boolean) => void;
	readonly disabled: boolean;
}

function SurfaceCheckbox({ surface, checked, onToggle, disabled }: SurfaceCheckboxProps): React.JSX.Element {
	const handleChange = React.useCallback(
		(next: boolean): void => {
			onToggle(surface, next);
		},
		[onToggle, surface],
	);
	return (
		<Label className={BROADCAST_CHOICE_SURFACE_CLASS}>
			<Checkbox checked={checked} onCheckedChange={handleChange} disabled={disabled} className="mt-0.5" />
			<span className="flex flex-col gap-0.5">
				<span className="text-sm font-medium text-foreground">{PLATFORM_SURFACE_LABELS[surface].label}</span>
				<span className="text-xs text-muted-foreground">{PLATFORM_SURFACE_LABELS[surface].hint}</span>
			</span>
		</Label>
	);
}

/** The live count: how many people get it, how many are left out and why (never who), and whether it needs a second approval. */
function AudienceCount({ values, senderTimeZone }: { readonly values: PlatformBroadcastValues; readonly senderTimeZone: string }): React.JSX.Element | null {
	const { api } = useAuth();
	// Built from plain values, so the same filters keep the same audience and never recount.
	const { signedUpAfter, tenantStates } = values;
	const surfacesKey = values.surfaces.join(",");
	const current = React.useMemo(
		() =>
			toPlatformAudience(
				{ surfaces: PlatformSurfaceSchema.options.filter((surface) => surfacesKey.split(",").includes(surface)), signedUpAfter, tenantStates },
				senderTimeZone,
			),
		[senderTimeZone, signedUpAfter, surfacesKey, tenantStates],
	);
	const audience = useDebouncedValue(current, PREVIEW_DEBOUNCE_MS);
	const preview = api.notificationsAdmin.broadcastAudiencePreview.useMutation();
	const { mutate } = preview;
	React.useEffect((): void => {
		if (audience.surfaces.length > 0) {
			mutate(audience);
		}
	}, [audience, mutate]);

	const result = preview.data?.data;
	if (current.surfaces.length === 0 || result === undefined) {
		return null;
	}
	const leftOut = result.leftOut.filter((entry) => entry.count > 0);
	const leftOutTotal = leftOut.reduce((sum, entry) => sum + entry.count, 0);
	return (
		<div role="status" className="flex flex-col gap-1 rounded-lg bg-muted/60 px-3 py-2 text-sm text-foreground">
			<p>
				<span className="font-medium tabular-nums">{result.eligible === 1 ? "1 person" : `${String(result.eligible)} people`}</span> will get this.
				{leftOutTotal === 0 ? null : (
					<span className="text-muted-foreground">
						{" "}
						{leftOutTotal} left out ({leftOut.map((entry) => `${String(entry.count)} ${LEFT_OUT_LABELS[entry.reason]}`).join(", ")}).
					</span>
				)}
			</p>
			{needsSecondApproval(current) ? <p className="text-muted-foreground">It reaches everyone, so a second staff member approves it before it goes out.</p> : null}
		</div>
	);
}
