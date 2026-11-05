"use client";

import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { contractFormSchema } from "@workspace/client/lib/forms/contract-form-schema";
import { CreateStatusIncidentSchema, STATUS_COMPONENT_KEYS, StatusComponentKeySchema, StatusIncidentImpactSchema, type CreateStatusIncidentInput } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { toastMessage } from "@workspace/ui/components/toast";
import { useRouter } from "next/navigation";
import * as React from "react";
import { z } from "zod";

import { CheckboxGroupField, OptionSelectField, TextField, useFormSubmitHandler } from "@/components/common/form-fields";
import { toastMutationError } from "@/lib/api/mutation-error";
import { ROUTES } from "@/lib/routes";

import { componentLabel, impactLabel } from "../../lib/status-page-labels";

/** Raw form → the shared create contract (same rules as the API). */
export const NewStatusIncidentFormSchema = contractFormSchema(
	z.object({ title: z.string().trim(), impact: StatusIncidentImpactSchema, components: z.array(StatusComponentKeySchema), message: z.string().trim() }),
	CreateStatusIncidentSchema,
);
type NewStatusIncidentFormValues = z.input<typeof NewStatusIncidentFormSchema>;

const EMPTY: NewStatusIncidentFormValues = { title: "", impact: "MINOR", components: [], message: "" };

/** `/operations/status/new`: open an incident; customers see it on the public status page at once. */
export function NewStatusIncidentForm(): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const router = useRouter();
	const mutation = api.operations.createStatusIncident.useMutation({
		onSuccess: async (response): Promise<void> => {
			toastMessage.success({ title: "Incident opened", description: "It's on the public status page now." });
			await queryClient.invalidateQueries({ queryKey: apiRouter.operations.statusIncidents.queryKey(undefined) });
			router.push(ROUTES.operations.statusIncident(response.data.id));
		},
		onError: (error): void => {
			toastMutationError("Could not open the incident", error);
		},
	});
	const { mutateAsync } = mutation;
	const form = useForm({
		defaultValues: EMPTY,
		validators: { onSubmit: NewStatusIncidentFormSchema },
		onSubmit: async ({ value }): Promise<void> => {
			const incident: CreateStatusIncidentInput = NewStatusIncidentFormSchema.parse(value);
			await mutateAsync(incident);
		},
	});
	const submit = React.useCallback((): Promise<void> => form.handleSubmit(), [form]);
	const handleSubmit = useFormSubmitHandler(submit);
	return (
		<div className="flex flex-col gap-6">
			<header className="flex flex-col gap-1">
				<h1 className="text-2xl font-semibold tracking-tight">Open an incident</h1>
				<p className="text-sm text-muted-foreground">Say what customers notice, not the cause: you can explain more in later updates.</p>
			</header>
			<Card>
				<CardHeader>
					<CardTitle>The incident</CardTitle>
					<CardDescription>It starts as Investigating, with your message as its first update.</CardDescription>
				</CardHeader>
				<CardContent>
					<form noValidate className="flex max-w-2xl flex-col gap-4" onSubmit={handleSubmit}>
						<form.Field name="title">
							{(field) => (
								<TextField
									id="status-incident-title"
									label="Title"
									value={field.state.value}
									onChange={field.handleChange}
									onBlur={field.handleBlur}
									errors={field.state.meta.errors}
									placeholder="e.g. Emails are delayed"
								/>
							)}
						</form.Field>
						<form.Field name="impact">
							{(field) => (
								<OptionSelectField
									id="status-incident-impact"
									label="Impact"
									value={field.state.value}
									options={StatusIncidentImpactSchema.options}
									onChange={field.handleChange}
									labelOf={impactLabel}
									errors={field.state.meta.errors}
								/>
							)}
						</form.Field>
						<form.Field name="components">
							{(field) => (
								<CheckboxGroupField
									id="status-incident-components"
									label="What's affected"
									value={field.state.value}
									options={STATUS_COMPONENT_KEYS}
									onChange={field.handleChange}
									labelOf={componentLabel}
									errors={field.state.meta.errors}
								/>
							)}
						</form.Field>
						<form.Field name="message">
							{(field) => (
								<TextField
									id="status-incident-message"
									label="First update"
									multiline
									value={field.state.value}
									onChange={field.handleChange}
									onBlur={field.handleBlur}
									errors={field.state.meta.errors}
									placeholder="What customers notice, and that you're on it"
								/>
							)}
						</form.Field>
						<div>
							<Button type="submit" disabled={mutation.isPending}>
								Open incident
							</Button>
						</div>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
