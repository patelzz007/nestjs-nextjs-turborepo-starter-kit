"use client";

import type { CustomerPickerOption } from "@/components/merchant-ui/customer-picker";
import { BroadcastRecipientsFields } from "@/contexts/notifications/components/broadcast-recipients-fields";
import { toBroadcastDraft, type BroadcastComposerValues } from "@/contexts/notifications/lib/broadcast-composer";
import {
	BroadcastComposerForm,
	type BroadcastAudienceSlot,
	type BroadcastComposerCopy,
	type BroadcastSaveIntent,
} from "@workspace/client/lib/features/broadcasts/broadcast-composer-form";
import type { BroadcastDraftResult } from "@workspace/client/lib/features/broadcasts/broadcast-draft";
import type { BroadcastDraftInput } from "@workspace/shared";
import * as React from "react";

export type { BroadcastSaveIntent };

const MERCHANT_COPY: BroadcastComposerCopy = {
	titlePlaceholder: "e.g. Half price lattes this Saturday",
	bodyPlaceholder: "Write your message. Add a link or a button customers can tap.",
	audienceTitle: "Who gets it",
	audienceDescription: "Only customers who agreed to hear from you receive it. Your team never does.",
	deliveryDescription: "Each customer gets it the ways their own settings allow.",
	atTimeHint: "In your store's time zone.",
	recipientLocalLabel: "At a set time for each customer",
	recipientLocalHint: "9:00 means 9:00 wherever they are.",
	previewHeading: "What customers see",
};

export interface MerchantBroadcastComposerProps {
	readonly tenantSlug: string;
	readonly storeTimeZone: string;
	readonly initialValues: BroadcastComposerValues;
	/** The people already picked (editing), so the picker names them at once. */
	readonly initialCustomers: readonly CustomerPickerOption[];
	/** Whether this member may send (`merchant:publish_broadcasts`); otherwise drafts only. */
	readonly canSend: boolean;
	/** Sending is out of the question this week (limit reached, or broadcasting switched off). */
	readonly sendBlockedReason: string | null;
	readonly isSaving: boolean;
	readonly savingIntent: BroadcastSaveIntent | undefined;
	readonly onSave: (draft: BroadcastDraftInput, intent: BroadcastSaveIntent) => void;
	readonly cancel: React.ReactNode;
}

/**
 * The store's broadcast composer (ADR 073): the shared composer, with the store's own customers as the
 * audience — all of them (by how recently they claimed and whether they redeemed) or a hand-picked group.
 */
export function MerchantBroadcastComposer({
	tenantSlug,
	storeTimeZone,
	initialValues,
	initialCustomers,
	canSend,
	sendBlockedReason,
	isSaving,
	savingIntent,
	onSave,
	cancel,
}: MerchantBroadcastComposerProps): React.JSX.Element {
	const toDraft = React.useCallback((values: BroadcastComposerValues, now: number): BroadcastDraftResult => toBroadcastDraft(values, storeTimeZone, now), [storeTimeZone]);
	const renderAudience = React.useCallback(
		({ values, onChange, error, disabled }: BroadcastAudienceSlot<BroadcastComposerValues>): React.ReactNode => (
			<BroadcastRecipientsFields tenantSlug={tenantSlug} values={values} onChange={onChange} initialCustomers={initialCustomers} errorMessage={error} disabled={disabled} />
		),
		[initialCustomers, tenantSlug],
	);
	return (
		<BroadcastComposerForm<BroadcastComposerValues>
			initialValues={initialValues}
			copy={MERCHANT_COPY}
			toDraft={toDraft}
			renderAudience={renderAudience}
			sendDisabledReason={canSend ? sendBlockedReason : "Only your store owner can send broadcasts. Save it as a draft for them."}
			isSaving={isSaving}
			savingIntent={savingIntent}
			onSave={onSave}
			cancel={cancel}
		/>
	);
}
