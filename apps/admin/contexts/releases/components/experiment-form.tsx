"use client";

import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { useProgressRouter } from "@workspace/client/lib/navigation/use-progress-router";
import {
	CreateExperimentSchema,
	DynamicConfigKeySchema,
	EXPERIMENT_METRIC_REGISTRY,
	ExperimentMetricKeySchema,
	UpdateExperimentSchema,
	type DynamicConfigKey,
	type Experiment,
	type ExperimentMetricKey,
	type ExperimentVariant,
} from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { FieldError } from "@workspace/ui/components/field";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { toastMessage } from "@workspace/ui/components/toast";
import { Plus, Trash2 } from "lucide-react";
import * as React from "react";
import { z } from "zod";

import { CheckboxGroupField, OptionSelectField, TextField, useFormSubmitHandler } from "@/components/common/form-fields";
import { toastMutationError } from "@/lib/api/mutation-error";
import { ROUTES } from "@/lib/routes";

import { DateTimeInput, PercentInput } from "./release-fields";
import { epochFromLocal, localFromEpoch } from "./rule-editor/condition-editor";

const RELEASES_SCOPE: readonly string[] = ["admin", "releases"];
const EVEN_SPLIT = 50;

interface ExperimentFormValues {
	key: string;
	configKey: DynamicConfigKey;
	name: string;
	hypothesis: string;
	trafficPercentage: number;
	variants: ExperimentVariant[];
	controlValueName: string;
	primaryMetric: ExperimentMetricKey;
	guardrailMetrics: ExperimentMetricKey[];
	plannedEndAt: string;
	reason: string;
}

const PlanShape = {
	name: z.string(),
	hypothesis: z.string(),
	trafficPercentage: z.number(),
	variants: z.array(z.object({ valueName: z.string(), allocation: z.number() })),
	controlValueName: z.string(),
	primaryMetric: ExperimentMetricKeySchema,
	guardrailMetrics: z.array(ExperimentMetricKeySchema),
	plannedEndAt: z.string(),
	reason: z.string(),
};

/** The plan's own fields (never the key or config, which a draft can't change), its end as epoch ms. */
function planOf(form: z.output<z.ZodObject<typeof PlanShape>>): z.input<typeof UpdateExperimentSchema> {
	return {
		name: form.name,
		hypothesis: form.hypothesis,
		trafficPercentage: form.trafficPercentage,
		variants: form.variants,
		controlValueName: form.controlValueName,
		primaryMetric: form.primaryMetric,
		guardrailMetrics: form.guardrailMetrics,
		plannedEndAt: epochFromLocal(form.plannedEndAt),
		reason: form.reason,
	};
}

/** Planning: the form → the create contract (variants share 100%, the control is one of them). */
export const CreateExperimentFormSchema = z
	.object({ ...PlanShape, key: z.string(), configKey: DynamicConfigKeySchema })
	.transform((form): z.input<typeof CreateExperimentSchema> => ({ ...planOf(form), key: form.key.trim(), configKey: form.configKey }))
	.pipe(CreateExperimentSchema);

/** A draft's changes: the form → the update contract. */
export const UpdateExperimentFormSchema = z
	.object({ ...PlanShape, key: z.string(), configKey: DynamicConfigKeySchema })
	.transform((form): z.input<typeof UpdateExperimentSchema> => planOf(form))
	.pipe(UpdateExperimentSchema);

function metricLabel(metric: ExperimentMetricKey): string {
	return EXPERIMENT_METRIC_REGISTRY[metric].title;
}

/** The form's config (the variants are its values). */
function selectConfigKey(state: { readonly values: ExperimentFormValues }): DynamicConfigKey {
	return state.values.configKey;
}

/** The values the variants name, once each (the control is one of them). */
function selectVariantNames(state: { readonly values: ExperimentFormValues }): string[] {
	return [...new Set(state.values.variants.map((variant) => variant.valueName))];
}

/** `/releases/experiments/new` and `/releases/experiments/[id]/edit` (ADR 087): an experiment's plan (a draft only). */
export function ExperimentFormPage({ experimentId }: { readonly experimentId: string | null }): React.JSX.Element {
	const { api } = useAuth();
	const experiment = api.featureFlags.experiment.useQuery({ experimentId: experimentId ?? "" }, { enabled: experimentId !== null }).data?.data;
	if (experimentId !== null && experiment === undefined) {
		return <Skeleton className="h-96 w-full rounded-xl" />;
	}
	return <ExperimentForm experiment={experiment ?? null} />;
}

function ExperimentForm({ experiment }: { readonly experiment: Experiment | null }): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const router = useProgressRouter();
	const [problem, setProblem] = React.useState<string | null>(null);
	const done = async (saved: Experiment): Promise<void> => {
		toastMessage.success({ title: `${saved.name} saved as a draft` });
		await queryClient.invalidateQueries({ queryKey: RELEASES_SCOPE });
		router.push(ROUTES.releases.experiments.detail(saved.id));
	};
	const create = api.featureFlags.createExperiment.useMutation({
		onSuccess: (response) => done(response.data),
		onError: (error): void => {
			toastMutationError("Could not plan the experiment", error);
		},
	});
	const update = api.featureFlags.updateExperiment.useMutation({
		onSuccess: (response) => done(response.data),
		onError: (error): void => {
			toastMutationError("Could not save the plan", error);
		},
	});
	const [firstConfig = "reward-claim-cta"] = DynamicConfigKeySchema.options;
	const defaults: ExperimentFormValues = {
		key: experiment?.key ?? "",
		configKey: experiment?.configKey ?? firstConfig,
		name: experiment?.name ?? "",
		hypothesis: experiment?.hypothesis ?? "",
		trafficPercentage: experiment?.trafficPercentage ?? EVEN_SPLIT,
		variants: experiment === null ? [] : [...experiment.variants],
		controlValueName: experiment?.controlValueName ?? "",
		primaryMetric: experiment?.primaryMetric ?? "reward-claims",
		guardrailMetrics: experiment === null ? [] : [...experiment.guardrailMetrics],
		plannedEndAt: localFromEpoch(experiment?.plannedEndAt ?? null),
		reason: "",
	};
	const form = useForm({
		defaultValues: defaults,
		onSubmit: async ({ value }): Promise<void> => {
			if (experiment === null) {
				const parsed = CreateExperimentFormSchema.safeParse(value);
				setProblem(parsed.success ? null : z.prettifyError(parsed.error));
				if (parsed.success) {
					await create.mutateAsync(parsed.data);
				}
				return;
			}
			const parsed = UpdateExperimentFormSchema.safeParse(value);
			setProblem(parsed.success ? null : z.prettifyError(parsed.error));
			if (parsed.success) {
				await update.mutateAsync({ experimentId: experiment.id, ...parsed.data });
			}
		},
	});
	const submit = React.useCallback((): Promise<void> => form.handleSubmit(), [form]);
	const handleSubmit = useFormSubmitHandler(submit);
	// Variants are values of one config: another config starts them afresh.
	const changeConfig = React.useCallback(
		(configKey: DynamicConfigKey): void => {
			form.setFieldValue("configKey", configKey);
			form.setFieldValue("variants", []);
			form.setFieldValue("controlValueName", "");
		},
		[form],
	);
	// The control is always one of the variants: keep it, or take the first.
	const changeVariants = React.useCallback(
		(variants: ExperimentVariant[]): void => {
			form.setFieldValue("variants", variants);
			const names = variants.map((variant) => variant.valueName);
			const [first = ""] = names;
			if (!names.includes(form.getFieldValue("controlValueName"))) {
				form.setFieldValue("controlValueName", first);
			}
		},
		[form],
	);
	const isNew = experiment === null;
	return (
		<div className="flex flex-col gap-6">
			<header className="flex flex-col gap-1">
				<h1 className="text-2xl font-semibold tracking-tight">{isNew ? "Plan an experiment" : `Edit the plan: ${experiment.name}`}</h1>
				<p className="text-sm text-muted-foreground">Its variants are values of a dynamic config. It stays a draft until you start it.</p>
			</header>
			<form noValidate onSubmit={handleSubmit}>
				<Card>
					<CardHeader>
						<CardTitle>The plan</CardTitle>
						<CardDescription>The variants share 100% of the people taking part; the control is what the others are compared with.</CardDescription>
					</CardHeader>
					<CardContent className="flex max-w-3xl flex-col gap-4">
						{isNew ? (
							<>
								<form.Field name="key">
									{(field) => (
										<TextField
											id="experiment-key"
											label="Key"
											value={field.state.value}
											onChange={field.handleChange}
											onBlur={field.handleBlur}
											errors={field.state.meta.errors}
											placeholder="e.g. bold-claim-button"
										/>
									)}
								</form.Field>
								<form.Field name="configKey">
									{(field) => (
										<OptionSelectField
											id="experiment-config"
											label="Dynamic config"
											value={field.state.value}
											options={DynamicConfigKeySchema.options}
											onChange={changeConfig}
										/>
									)}
								</form.Field>
							</>
						) : null}
						<form.Field name="name">
							{(field) => (
								<TextField
									id="experiment-name"
									label="Name"
									value={field.state.value}
									onChange={field.handleChange}
									onBlur={field.handleBlur}
									errors={field.state.meta.errors}
								/>
							)}
						</form.Field>
						<form.Field name="hypothesis">
							{(field) => (
								<TextField
									id="experiment-hypothesis"
									label="Hypothesis"
									multiline
									value={field.state.value}
									onChange={field.handleChange}
									onBlur={field.handleBlur}
									errors={field.state.meta.errors}
									placeholder="e.g. A bolder Claim button leads more people to claim"
								/>
							)}
						</form.Field>
						<form.Field name="trafficPercentage">
							{(field) => (
								<PercentInput
									id="experiment-traffic"
									label="Share of the config's audience taking part (%)"
									value={field.state.value}
									onChange={field.handleChange}
									className="max-w-48 space-y-1.5"
								/>
							)}
						</form.Field>
						<form.Subscribe selector={selectConfigKey}>
							{(configKey) => (
								<ConfigValueNames configKey={configKey}>
									{(valueNames) => (
										<form.Field name="variants">{(field) => <VariantsEditor valueNames={valueNames} variants={field.state.value} onChange={changeVariants} />}</form.Field>
									)}
								</ConfigValueNames>
							)}
						</form.Subscribe>
						<form.Subscribe selector={selectVariantNames}>
							{(variantNames) =>
								variantNames.length === 0 ? null : (
									<form.Field name="controlValueName">
										{(field) => (
											<OptionSelectField
												id="experiment-control"
												label="Control (what the others are compared with)"
												value={field.state.value}
												options={variantNames}
												onChange={field.handleChange}
											/>
										)}
									</form.Field>
								)
							}
						</form.Subscribe>
						<form.Field name="primaryMetric">
							{(field) => (
								<OptionSelectField
									id="experiment-primary"
									label="Primary metric"
									value={field.state.value}
									options={ExperimentMetricKeySchema.options}
									labelOf={metricLabel}
									onChange={field.handleChange}
								/>
							)}
						</form.Field>
						<form.Field name="guardrailMetrics">
							{(field) => (
								<CheckboxGroupField
									id="experiment-guardrails"
									label="Guardrail metrics (watched, not the goal)"
									value={field.state.value}
									options={ExperimentMetricKeySchema.options}
									labelOf={metricLabel}
									onChange={field.handleChange}
								/>
							)}
						</form.Field>
						<form.Field name="plannedEndAt">
							{(field) => (
								<DateTimeInput id="experiment-end" label="Planned end (optional)" value={field.state.value} onChange={field.handleChange} className="max-w-64 space-y-1.5" />
							)}
						</form.Field>
						<form.Field name="reason">
							{(field) => (
								<TextField
									id="experiment-reason"
									label="Why (kept in the audit log)"
									value={field.state.value}
									onChange={field.handleChange}
									onBlur={field.handleBlur}
									errors={field.state.meta.errors}
									placeholder="e.g. Agreed at the design review"
								/>
							)}
						</form.Field>
						{problem === null ? null : <FieldError errors={[{ message: problem }]} />}
						<div>
							<Button type="submit" disabled={create.isPending || update.isPending}>
								{isNew ? "Save as a draft" : "Save the plan"}
							</Button>
						</div>
					</CardContent>
				</Card>
			</form>
		</div>
	);
}

/** Loads the value names of a config's live revision and hands them to its children (or says there are none). */
function ConfigValueNames({
	configKey,
	children,
}: {
	readonly configKey: DynamicConfigKey;
	readonly children: (valueNames: readonly string[]) => React.ReactNode;
}): React.JSX.Element {
	const { api } = useAuth();
	const config = api.featureFlags.config.useQuery({ key: configKey }).data?.data;
	if (config === undefined) {
		return <Skeleton className="h-24 w-full rounded-xl" />;
	}
	const valueNames = config.live?.content.kind === "CONFIG" ? config.live.content.values.map((value) => value.name) : [];
	if (valueNames.length === 0) {
		return <p className="text-sm text-muted-foreground">This config has no values yet: add them to the config first.</p>;
	}
	return <>{children(valueNames)}</>;
}

export interface VariantsEditorProps {
	readonly valueNames: readonly string[];
	readonly variants: readonly ExperimentVariant[];
	readonly onChange: (variants: ExperimentVariant[]) => void;
}

interface VariantRowProps {
	readonly index: number;
	readonly variants: readonly ExperimentVariant[];
	readonly valueNames: readonly string[];
	readonly onChange: (variants: ExperimentVariant[]) => void;
}

/** One variant: which value, its share, and removing it. */
function VariantRow({ index, variants, valueNames, onChange }: VariantRowProps): React.JSX.Element | null {
	const variant = variants.at(index);
	const replace = React.useCallback(
		(next: ExperimentVariant): void => {
			onChange(variants.map((existing, position) => (position === index ? next : existing)));
		},
		[index, onChange, variants],
	);
	const setValue = React.useCallback(
		(valueName: string): void => {
			if (variant !== undefined) {
				replace({ ...variant, valueName });
			}
		},
		[replace, variant],
	);
	const setShare = React.useCallback(
		(allocation: number): void => {
			if (variant !== undefined) {
				replace({ ...variant, allocation });
			}
		},
		[replace, variant],
	);
	const remove = React.useCallback((): void => {
		onChange(variants.filter((_existing, position) => position !== index));
	}, [index, onChange, variants]);
	if (variant === undefined) {
		return null;
	}
	const id = `variant-${String(index)}`;
	return (
		<div className="grid items-end gap-2 sm:grid-cols-[1fr_8rem_auto]">
			<OptionSelectField id={`${id}-value`} label="Value" value={variant.valueName} options={valueNames} onChange={setValue} />
			<PercentInput id={`${id}-share`} label="Share (%)" value={variant.allocation} onChange={setShare} />
			<Button type="button" variant="ghost" size="icon" aria-label={`Remove variant ${String(index + 1)}`} onClick={remove}>
				<Trash2 className="size-4" />
			</Button>
		</div>
	);
}

/** The variants (controlled): each a value of the config with its share of the people taking part. */
export function VariantsEditor({ valueNames, variants, onChange }: VariantsEditorProps): React.JSX.Element {
	const [firstValue = ""] = valueNames;
	const add = React.useCallback((): void => {
		onChange([...variants, { valueName: firstValue, allocation: EVEN_SPLIT }]);
	}, [firstValue, onChange, variants]);
	return (
		<fieldset className="flex flex-col gap-2">
			<legend className="text-sm font-medium">Variants</legend>
			{variants.map((variant, index): React.JSX.Element => (
				<VariantRow key={`variant-${String(index)}-${variant.valueName}`} index={index} variants={variants} valueNames={valueNames} onChange={onChange} />
			))}
			<div>
				<Button type="button" variant="outline" size="sm" onClick={add}>
					<Plus className="size-4" />
					Add a variant
				</Button>
			</div>
		</fieldset>
	);
}
