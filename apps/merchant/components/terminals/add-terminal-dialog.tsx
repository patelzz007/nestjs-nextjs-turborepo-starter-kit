"use client";

import { MerchantCreateTerminalSchema, POS_TERMINAL_NAME_MAX_LENGTH, type MerchantCreateTerminalInput } from "@workspace/shared";
import { Button } from "@workspace/ui/components/form/button";
import { Input } from "@workspace/ui/components/form/input";
import { Label } from "@workspace/ui/components/form/label";
import { NativeSelect, NativeSelectOption } from "@workspace/ui/components/form/native-select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui/components/overlay/dialog";
import { Plus } from "lucide-react";
import * as React from "react";

/** A store the till can be registered at. */
export interface TerminalStoreOption {
	readonly id: string;
	readonly name: string;
}

export interface AddTerminalDialogProps {
	readonly open: boolean;
	readonly onOpenChange: (open: boolean) => void;
	/** Stores the member may register a till at. */
	readonly stores: readonly TerminalStoreOption[];
	/** Preselected store (the active store, or the only one); `undefined` = the merchant picks. */
	readonly defaultStoreId: string | undefined;
	readonly isPending: boolean;
	/** The last attempt's failure, shown inline so the input is kept. */
	readonly errorMessage: string | null;
	/** Receives the input already parsed by the shared create schema (trimmed name). */
	readonly onSubmit: (input: MerchantCreateTerminalInput) => void;
}

/** "Add terminal" dialog: name + store. Presentational — the parent owns the mutation. */
export function AddTerminalDialog({ open, onOpenChange, stores, defaultStoreId, isPending, errorMessage, onSubmit }: AddTerminalDialogProps): React.JSX.Element {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				{/* Mounted only while open, so every opening starts from a fresh draft. */}
				<AddTerminalForm stores={stores} defaultStoreId={defaultStoreId} isPending={isPending} errorMessage={errorMessage} onSubmit={onSubmit} />
			</DialogContent>
		</Dialog>
	);
}

type AddTerminalFormProps = Omit<AddTerminalDialogProps, "open" | "onOpenChange">;

function AddTerminalForm({ stores, defaultStoreId, isPending, errorMessage, onSubmit }: AddTerminalFormProps): React.JSX.Element {
	const [name, setName] = React.useState<string>("");
	const [storeId, setStoreId] = React.useState<string>(defaultStoreId ?? "");

	// The same schema the API validates with — the client never keeps a second set of rules.
	const parsed = MerchantCreateTerminalSchema.safeParse({ name, locationId: storeId });

	const handleNameChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setName(event.target.value);
	}, []);

	const handleStoreChange = React.useCallback((event: React.ChangeEvent<HTMLSelectElement>): void => {
		setStoreId(event.target.value);
	}, []);

	const handleSubmit = React.useCallback(
		(event: React.SyntheticEvent<HTMLFormElement>): void => {
			event.preventDefault();
			if (parsed.success) {
				onSubmit(parsed.data);
			}
		},
		[onSubmit, parsed],
	);

	return (
		<form className="grid gap-6" onSubmit={handleSubmit} noValidate>
			<DialogHeader>
				<DialogTitle>Add a terminal</DialogTitle>
				<DialogDescription>Name the till and pick its store. You&apos;ll get a one-time code to enter on the till.</DialogDescription>
			</DialogHeader>

			<div className="grid gap-4">
				<div className="grid gap-2">
					<Label htmlFor="terminal-name">Terminal name</Label>
					<Input
						id="terminal-name"
						value={name}
						onChange={handleNameChange}
						placeholder="Front counter"
						maxLength={POS_TERMINAL_NAME_MAX_LENGTH}
						autoComplete="off"
						required
						aria-describedby="terminal-name-hint"
					/>
					<p id="terminal-name-hint" className="text-xs text-muted-foreground">
						Shown on this page and in redemption history — e.g. the counter or device it sits on.
					</p>
				</div>
				<div className="grid gap-2">
					<Label htmlFor="terminal-store">Store</Label>
					<NativeSelect id="terminal-store" className="w-full" value={storeId} onChange={handleStoreChange} required disabled={stores.length === 0}>
						<NativeSelectOption value="" disabled>
							Choose a store
						</NativeSelectOption>
						{stores.map((store: TerminalStoreOption): React.JSX.Element => (
							<NativeSelectOption key={store.id} value={store.id}>
								{store.name}
							</NativeSelectOption>
						))}
					</NativeSelect>
					{stores.length === 0 ? <p className="text-xs text-muted-foreground">No active store yet — add one under Settings › Locations first.</p> : null}
				</div>
				{errorMessage === null ? null : (
					<p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
						{errorMessage}
					</p>
				)}
			</div>

			<DialogFooter>
				<Button type="submit" loading={isPending} disabled={isPending || !parsed.success}>
					<Plus className="size-4" aria-hidden="true" />
					Add terminal
				</Button>
			</DialogFooter>
		</form>
	);
}
