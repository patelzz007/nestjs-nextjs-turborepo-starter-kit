"use client";

import { useForm } from "@tanstack/react-form";
import {
	CheckPermissionSchema,
	PermissionActionSchema,
	PermissionResourceSchema,
	type CheckPermissionInput,
	type CheckPermissionResponse,
	type PermissionAction,
	type PermissionResource,
} from "@workspace/shared";
import { Button } from "@workspace/ui/components/form/button";
import { ShieldCheck, ShieldX } from "lucide-react";
import * as React from "react";

import { OptionSelectField, TextField, useFormSubmitHandler } from "@/components/common/form-fields";
import { formatPermissionGrantVia } from "@/lib/permissions/format-permission-grant";

/** Starting selection: the most common question, "can this user read users?". */
const DEFAULT_ACTION: PermissionAction = PermissionActionSchema.enum.READ;
const DEFAULT_RESOURCE: PermissionResource = PermissionResourceSchema.enum.USER;

export interface PermissionCheckFormProps {
	/** Checks this user; when omitted, the form asks for a user id. */
	readonly userId?: string;
	readonly isPending: boolean;
	/** Called with values parsed by the shared `CheckPermissionSchema`. */
	readonly onCheck: (input: CheckPermissionInput) => void;
	readonly submitLabel: string;
	/** Prefix for the field ids, unique per page. */
	readonly idPrefix: string;
}

/**
 * The `POST /admin/permissions/check` form: user id (unless fixed), action and
 * resource, validated with the shared `CheckPermissionSchema` — the same
 * schema the API validates with. Option lists come from the shared enums.
 * Data-agnostic: the caller owns the mutation and the result.
 */
export function PermissionCheckForm({ userId, isPending, onCheck, submitLabel, idPrefix }: PermissionCheckFormProps): React.JSX.Element {
	const form = useForm({
		defaultValues: { userId: userId ?? "", action: DEFAULT_ACTION, resource: DEFAULT_RESOURCE },
		validators: { onSubmit: CheckPermissionSchema },
		onSubmit: ({ value }): void => {
			onCheck(CheckPermissionSchema.parse(value));
		},
	});

	const submit = React.useCallback((): Promise<void> => form.handleSubmit(), [form]);
	const handleFormSubmit = useFormSubmitHandler(submit);

	return (
		<form noValidate className="space-y-4" onSubmit={handleFormSubmit}>
			{userId === undefined ? (
				<form.Field name="userId">
					{(field) => (
						<TextField
							id={`${idPrefix}-user-id`}
							label="User ID"
							placeholder="UUID"
							value={field.state.value}
							onChange={field.handleChange}
							onBlur={field.handleBlur}
							errors={field.state.meta.errors}
						/>
					)}
				</form.Field>
			) : null}
			<div className="grid gap-4 sm:grid-cols-2">
				<form.Field name="action">
					{(field) => (
						<OptionSelectField id={`${idPrefix}-action`} label="Action" value={field.state.value} options={PermissionActionSchema.options} onChange={field.handleChange} />
					)}
				</form.Field>
				<form.Field name="resource">
					{(field) => (
						<OptionSelectField
							id={`${idPrefix}-resource`}
							label="Resource"
							value={field.state.value}
							options={PermissionResourceSchema.options}
							onChange={field.handleChange}
						/>
					)}
				</form.Field>
			</div>
			<Button type="submit" disabled={isPending}>
				{submitLabel}
			</Button>
		</form>
	);
}

export interface PermissionCheckResultProps {
	readonly result: CheckPermissionResponse;
}

/** Allowed/denied verdict of a permission check, with every grant that produced it. */
export function PermissionCheckResult({ result }: PermissionCheckResultProps): React.JSX.Element {
	return (
		<div className="rounded-lg border bg-muted/30 p-4">
			<div className="flex items-center gap-2 text-sm font-medium">
				{result.allowed ? <ShieldCheck className="size-4 text-success" /> : <ShieldX className="size-4 text-destructive" />}
				{result.allowed ? "Allowed" : "Denied"}
			</div>
			{result.grants.length > 0 ? (
				<ul className="mt-2 space-y-1 border-l border-border pl-3 text-sm text-muted-foreground">
					{result.grants.map((grant, index) => (
						<li key={`${grant.via}-${grant.detail ?? ""}-${String(index)}`}>
							<span className="font-medium text-foreground">{formatPermissionGrantVia(grant.via)}</span>
							{grant.detail !== undefined ? ` — ${grant.detail}` : ""}
						</li>
					))}
				</ul>
			) : (
				<p className="mt-2 text-sm text-muted-foreground">No matching grants.</p>
			)}
		</div>
	);
}
