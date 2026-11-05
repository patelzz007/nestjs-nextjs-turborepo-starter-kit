"use client";

import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { useAuthorization } from "@workspace/client/lib/contexts/authorization";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { contractFormSchema } from "@workspace/client/lib/forms/contract-form-schema";
import { PERMISSION, PostStatusIncidentUpdateSchema, StatusIncidentStateSchema, type PostStatusIncidentUpdateInput, type StatusIncident } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { StatusBadge } from "@workspace/ui/components/status-badge";
import { toastMessage } from "@workspace/ui/components/toast";
import * as React from "react";
import { z } from "zod";

import { OptionSelectField, TextField, useFormSubmitHandler } from "@/components/common/form-fields";
import { toastMutationError } from "@/lib/api/mutation-error";

import { formatDateTimeShort } from "../../lib/ops-format";
import { componentsSummary, IMPACT_SHORT_LABELS, IMPACT_TONES, STATE_LABELS, STATE_TONES, stateLabel } from "../../lib/status-page-labels";

/** Raw update form → the shared update contract (same rules as the API). */
export const StatusUpdateFormSchema = contractFormSchema(z.object({ state: StatusIncidentStateSchema, message: z.string().trim() }), PostStatusIncidentUpdateSchema);
type StatusUpdateFormValues = z.input<typeof StatusUpdateFormSchema>;

/** `/operations/status/[id]`: one incident as customers read it, its updates, and posting the next one. */
export function StatusIncidentDetail({ incidentId }: { readonly incidentId: string }): React.JSX.Element {
	const { api } = useAuth();
	const { can } = useAuthorization();
	const query = api.operations.statusIncident.useQuery({ incidentId });
	const incident = query.data?.data;
	if (incident === undefined) {
		return <Skeleton className="h-64 w-full rounded-xl" />;
	}
	const canPost = can(PERMISSION.STATUS_INCIDENT.UPDATE) && incident.resolvedAt === null;
	return (
		<div className="flex flex-col gap-6">
			<header className="flex flex-col gap-2">
				<h1 className="text-2xl font-semibold tracking-tight">{incident.title}</h1>
				<div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
					<StatusBadge tone={IMPACT_TONES[incident.impact]}>{IMPACT_SHORT_LABELS[incident.impact]}</StatusBadge>
					<StatusBadge tone={STATE_TONES[incident.state]}>{STATE_LABELS[incident.state]}</StatusBadge>
					<span>{componentsSummary(incident.components)}</span>
				</div>
				<p className="text-sm text-muted-foreground">
					Opened {formatDateTimeShort(incident.startedAt)}
					{incident.openedByName === null ? "" : ` by ${incident.openedByName}`}
					{incident.resolvedAt === null ? "" : `; resolved ${formatDateTimeShort(incident.resolvedAt)}`}
				</p>
			</header>
			{canPost ? <PostUpdateCard incident={incident} /> : null}
			<Card>
				<CardHeader>
					<CardTitle>Updates</CardTitle>
					<CardDescription>Newest first, exactly as the public page shows them. A posted update can&apos;t be changed.</CardDescription>
				</CardHeader>
				<CardContent>
					<ol className="flex flex-col gap-4" aria-label="Updates">
						{incident.updates.map((update): React.JSX.Element => (
							<li key={update.id} className="flex flex-col gap-1 border-s-2 border-border ps-3">
								<div className="flex flex-wrap items-center gap-2 text-sm">
									<StatusBadge tone={STATE_TONES[update.state]}>{STATE_LABELS[update.state]}</StatusBadge>
									<span className="text-muted-foreground">
										{formatDateTimeShort(update.postedAt)}
										{update.postedByName === null ? "" : `, ${update.postedByName}`}
									</span>
								</div>
								<p className="text-sm whitespace-pre-wrap">{update.message}</p>
							</li>
						))}
					</ol>
				</CardContent>
			</Card>
		</div>
	);
}

/** States an update can move an open incident to (the current one first is fine: "still investigating"). */
const UPDATE_STATES = StatusIncidentStateSchema.options;

function PostUpdateCard({ incident }: { readonly incident: StatusIncident }): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const mutation = api.operations.postStatusIncidentUpdate.useMutation({
		onSuccess: async (): Promise<void> => {
			toastMessage.success({ title: "Update posted", description: "It's on the public status page now." });
			await queryClient.invalidateQueries({ queryKey: apiRouter.operations.statusIncident.queryKey({ incidentId: incident.id }) });
			await queryClient.invalidateQueries({ queryKey: apiRouter.operations.statusIncidents.queryKey(undefined) });
		},
		onError: (error): void => {
			toastMutationError("Could not post the update", error);
		},
	});
	const { mutateAsync } = mutation;
	const defaults: StatusUpdateFormValues = { state: incident.state, message: "" };
	const form = useForm({
		defaultValues: defaults,
		validators: { onSubmit: StatusUpdateFormSchema },
		onSubmit: async ({ value, formApi }): Promise<void> => {
			const update: PostStatusIncidentUpdateInput = StatusUpdateFormSchema.parse(value);
			await mutateAsync({ incidentId: incident.id, ...update });
			formApi.reset();
		},
	});
	const submit = React.useCallback((): Promise<void> => form.handleSubmit(), [form]);
	const handleSubmit = useFormSubmitHandler(submit);
	return (
		<Card>
			<CardHeader>
				<CardTitle>Post an update</CardTitle>
				<CardDescription>Customers read this as written. Choose Resolved when it is over: nothing can be posted after.</CardDescription>
			</CardHeader>
			<CardContent>
				<form noValidate className="flex max-w-2xl flex-col gap-4" onSubmit={handleSubmit}>
					<form.Field name="state">
						{(field) => (
							<OptionSelectField
								id="status-update-state"
								label="Where it stands"
								value={field.state.value}
								options={UPDATE_STATES}
								onChange={field.handleChange}
								labelOf={stateLabel}
								errors={field.state.meta.errors}
							/>
						)}
					</form.Field>
					<form.Field name="message">
						{(field) => (
							<TextField
								id="status-update-message"
								label="Message"
								multiline
								value={field.state.value}
								onChange={field.handleChange}
								onBlur={field.handleBlur}
								errors={field.state.meta.errors}
								placeholder="What changed, and what customers should do (if anything)"
							/>
						)}
					</form.Field>
					<div>
						<Button type="submit" disabled={mutation.isPending}>
							Post update
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	);
}
