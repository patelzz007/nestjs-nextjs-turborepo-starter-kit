"use client";

import { Button } from "@workspace/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog";
import { Item, ItemActions, ItemContent, ItemDescription, ItemFooter, ItemTitle } from "@workspace/ui/components/item";
import {
	SignaturePad,
	SignaturePadArea,
	SignaturePadClear,
	SignaturePadControls,
	SignaturePadGuide,
	SignaturePadPlaceholder,
	SignaturePadPreview,
	SignaturePadUndo,
	type SignaturePadStroke,
} from "@workspace/ui/components/signature-pad";
import * as React from "react";

export function SignaturePad8Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const [signature, setSignature] = React.useState<SignaturePadStroke[]>([]);
	/* Edits land in a draft, so Cancel leaves the saved signature untouched. */
	const [draft, setDraft] = React.useState<SignaturePadStroke[]>([]);
	const editRef = React.useRef<HTMLButtonElement>(null);

	const handleEdit = React.useCallback(
		(event: React.MouseEvent<HTMLButtonElement>): void => {
			/* Safari does not focus a clicked button; focusing it here gives
			   both dialog libraries the same element to return focus to. */
			event.currentTarget.focus();
			setDraft(signature);
			setOpen(true);
		},
		[signature],
	);

	const handleRemove = React.useCallback((): void => {
		setSignature([]);
		/* Remove unmounts itself, so focus moves to the row's action. */
		editRef.current?.focus();
	}, []);

	const handleCancel = React.useCallback((): void => {
		setOpen(false);
	}, []);

	const handleSaveSignature = React.useCallback((): void => {
		setSignature(draft);
		setOpen(false);
	}, [draft]);

	return (
		<>
			<Item variant="outline" className="mx-auto w-full max-w-lg">
				<ItemContent>
					<ItemTitle>Authorized signature</ItemTitle>
					<ItemDescription>Printed on invoices and purchase orders.</ItemDescription>
				</ItemContent>
				<ItemActions>
					<Button ref={editRef} variant="outline" size="sm" onClick={handleEdit}>
						{signature.length > 0 ? "Edit" : "Add signature"}
					</Button>
				</ItemActions>
				{signature.length > 0 ? (
					<ItemFooter>
						<SignaturePadPreview strokes={signature} className="h-10 w-auto" />
						<Button variant="ghost" size="sm" onClick={handleRemove}>
							Remove
						</Button>
					</ItemFooter>
				) : null}
			</Item>
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="sm:max-w-lg">
					<DialogHeader>
						<DialogTitle>Draw your signature</DialogTitle>
						<DialogDescription>Saved to your profile and reused on new documents.</DialogDescription>
					</DialogHeader>
					<SignaturePad value={draft} onValueChange={setDraft}>
						<SignaturePadArea variant="muted" className="h-48">
							<SignaturePadGuide />
							<SignaturePadPlaceholder />
							<SignaturePadControls>
								<SignaturePadUndo />
								<SignaturePadClear />
							</SignaturePadControls>
						</SignaturePadArea>
					</SignaturePad>
					<DialogFooter>
						<Button variant="outline" onClick={handleCancel}>
							Cancel
						</Button>
						<Button disabled={draft.length === 0} onClick={handleSaveSignature}>
							Save signature
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
