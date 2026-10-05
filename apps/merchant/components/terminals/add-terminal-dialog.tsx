"use client";

import { fieldErrorMessage, formErrorMessage, type FormSubmissionError } from "@/lib/forms/api-field-errors";
import { parseCreateTerminalForm, type CreateTerminalField } from "@/lib/terminals/create-terminal-form";
import { POS_TERMINAL_ID_MAX_LENGTH, POS_TERMINAL_NAME_MAX_LENGTH, type MerchantCreateTerminalInput } from "@workspace/shared";
import { Button } from "@workspace/ui/components/form/button";
import { Input } from "@workspace/ui/components/form/input";
import { Label } from "@workspace/ui/components/form/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/form/select";
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
	/** The last attempt's failure — on the field it is about, or for the form — shown inline so the input is kept. */
	readonly submissionError: FormSubmissionError<CreateTerminalField> | null;
	/** Receives the input already parsed by the shared create schema (trimmed name; blank terminal id omitted). */
	readonly onSubmit: (input: MerchantCreateTerminalInput) => void;
}

/** "Add terminal" dialog: name + store. Presentational — the parent owns the mutation. */
export function AddTerminalDialog({ open, onOpenChange, stores, defaultStoreId, isPending, submissionError, onSubmit }: AddTerminalDialogProps): React.JSX.Element {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				{/* Mounted only while open, so every opening starts from a fresh draft. */}
				<AddTerminalForm stores={stores} defaultStoreId={defaultStoreId} isPending={isPending} submissionError={submissionError} onSubmit={onSubmit} />
			</DialogContent>
		</Dialog>
	);
}

type AddTerminalFormProps = Omit<AddTerminalDialogProps, "open" | "onOpenChange">;

function AddTerminalForm({ stores, defaultStoreId, isPending, submissionError, onSubmit }: AddTerminalFormProps): React.JSX.Element {
	const [name, setName] = React.useState<string>("");
	const [storeId, setStoreId] = React.useState<string>(defaultStoreId ?? "");
	const [terminalId, setTerminalId] = React.useState<string>("");

	// The same schema the API validates with — the client never keeps a second set of rules.
	const parsed = parseCreateTerminalForm({ name, storeId, terminalId });
	const terminalIdError = fieldErrorMessage(submissionError, "terminalId");
	const storeError = fieldErrorMessage(submissionError, "store");
	const formError = formErrorMessage(submissionError);

	const handleTerminalIdChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setTerminalId(event.target.value);
	}, []);

	const handleNameChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setName(event.target.value);
	}, []);

	const handleStoreChange = React.useCallback((value: string | null): void => {
		setStoreId(value ?? "");
	}, []);
	const storeName = React.useCallback((id: string): string => stores.find((store) => store.id === id)?.name ?? id, [stores]);

	const handleSubmit = React.useCallback(
		(event: React.SyntheticEvent<HTMLFormElement>): void => {
			event.preventDefault();
			if (parsed !== undefined) {
				onSubmit(parsed);
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
					<Select<string> value={storeId === "" ? null : storeId} onValueChange={handleStoreChange} disabled={stores.length === 0} required invalid={storeError !== undefined}>
						<SelectTrigger id="terminal-store" {...(storeError === undefined ? {} : { "aria-describedby": "terminal-store-error" })}>
							<SelectValue placeholder="Choose a store" formatValue={storeName} />
						</SelectTrigger>
						<SelectContent>
							{stores.map((store: TerminalStoreOption): React.JSX.Element => (
								<SelectItem key={store.id} value={store.id}>
									{store.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					{stores.length === 0 ? <p className="text-xs text-muted-foreground">No active store yet — add one under Settings › Locations first.</p> : null}
					{storeError === undefined ? null : (
						<p id="terminal-store-error" role="alert" className="text-xs text-destructive">
							{storeError}
						</p>
					)}
				</div>
				<div className="grid gap-2">
					<Label htmlFor="terminal-id">Terminal ID (optional)</Label>
					<Input
						id="terminal-id"
						value={terminalId}
						onChange={handleTerminalIdChange}
						placeholder="KL-REGISTER-01"
						maxLength={POS_TERMINAL_ID_MAX_LENGTH}
						autoComplete="off"
						aria-invalid={terminalIdError !== undefined}
						aria-describedby={terminalIdError === undefined ? "terminal-id-hint" : "terminal-id-hint terminal-id-error"}
					/>
					<p id="terminal-id-hint" className="text-xs text-muted-foreground">
						What the till sends as X-Terminal-Id. Leave blank to get a generated one.
					</p>
					{terminalIdError === undefined ? null : (
						<p id="terminal-id-error" role="alert" className="text-xs text-destructive">
							{terminalIdError}
						</p>
					)}
				</div>
				{formError === undefined ? null : (
					<p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
						{formError}
					</p>
				)}
			</div>

			<DialogFooter>
				<Button type="submit" loading={isPending} disabled={isPending || parsed === undefined}>
					<Plus className="size-4" aria-hidden="true" />
					Add terminal
				</Button>
			</DialogFooter>
		</form>
	);
}
