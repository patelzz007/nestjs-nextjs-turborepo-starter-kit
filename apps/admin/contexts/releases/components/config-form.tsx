"use client";

import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { useProgressRouter } from "@workspace/client/lib/navigation/use-progress-router";
import {
	ChangeReasonSchema,
	ConfigRevisionContentSchema,
	ConfigRuleSchema,
	ConfigValueNameSchema,
	isValidDynamicConfigValue,
	JsonObjectSchema,
	type ConfigRevisionContent,
	type ConfigRuleInput,
	type DynamicConfigDetail,
	type DynamicConfigKey,
	type JsonObject,
} from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { FieldError } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { Textarea } from "@workspace/ui/components/textarea";
import { toastMessage } from "@workspace/ui/components/toast";
import { Plus, Trash2 } from "lucide-react";
import * as React from "react";
import { z } from "zod";

import { TextField, useFormSubmitHandler } from "@/components/common/form-fields";
import { toastMutationError } from "@/lib/api/mutation-error";
import { ROUTES } from "@/lib/routes";

import { EnvironmentNote } from "./environment-note";
import { newFlagRule, RuleListEditor, type ValueChoice } from "./rule-editor/rule-list-editor";

const RELEASES_SCOPE: readonly string[] = ["admin", "releases"];
const JSON_INDENT = 2;

/** One named value as typed: its name and its JSON text. */
interface ValueDraft {
	readonly name: string;
	readonly text: string;
}

/** The JSON text as an object, or null when it isn't one. */
export function parseJsonObject(text: string): JsonObject | null {
	try {
		const parsed = JsonObjectSchema.safeParse(JSON.parse(text));
		return parsed.success ? parsed.data : null;
	} catch {
		return null;
	}
}

/** The first value's name, which a new rule gives (empty until a value is named: the form then asks for one). */
function firstName(names: readonly string[]): string {
	const [first = ""] = names;
	return first;
}

/** Whether a value's JSON text fits the config's declared shape. */
export function isValueTextValid(key: DynamicConfigKey, text: string): boolean {
	const value = parseJsonObject(text);
	return value !== null && isValidDynamicConfigValue(key, value);
}

interface ConfigSave {
	readonly content: ConfigRevisionContent;
	readonly reason: string;
}

/** The form's raw values → the save contract, every value checked against the config's declared shape. */
export function configFormSchema(key: DynamicConfigKey): z.ZodType<ConfigSave, ConfigFormValues> {
	return z
		.object({
			values: z.array(z.object({ name: ConfigValueNameSchema, text: z.string().refine((text) => isValueTextValid(key, text), "Not valid JSON of this config's shape") })),
			rules: z.array(ConfigRuleSchema),
			reason: ChangeReasonSchema,
		})
		.transform((form): ConfigSave => ({
			content: { kind: "CONFIG", values: form.values.map((value) => ({ name: value.name, value: parseJsonObject(value.text) ?? {} })), rules: form.rules },
			reason: form.reason,
		}))
		.superRefine((save, context): void => {
			// The whole revision's own checks (unique names and ids, every rule's value exists), reported on the form's fields.
			for (const issue of ConfigRevisionContentSchema.safeParse(save.content).error?.issues ?? []) {
				context.addIssue({ code: "custom", message: issue.message, path: issue.path });
			}
		});
}

interface ConfigFormValues {
	values: ValueDraft[];
	rules: ConfigRuleInput[];
	reason: string;
}

/** `/releases/configs/[key]/edit` (ADR 087): a dynamic config's named values and rules, saved as its next revision. */
export function ConfigFormPage({ configKey }: { readonly configKey: DynamicConfigKey }): React.JSX.Element {
	const { api } = useAuth();
	const config = api.featureFlags.config.useQuery({ key: configKey }).data?.data;
	const groups = api.featureFlags.groups.useQuery(undefined).data?.data.groups;
	if (config === undefined || groups === undefined) {
		return <Skeleton className="h-96 w-full rounded-xl" />;
	}
	return <ConfigForm config={config} groupKeys={groups.map((group) => group.key)} />;
}

function selectValueNames(state: { readonly values: ConfigFormValues }): string[] {
	return state.values.values.map((value) => value.name);
}

function ruleValueOf(rule: ConfigRuleInput): string {
	return rule.valueName;
}

function withRuleValue(rule: ConfigRuleInput, valueName: string): ConfigRuleInput {
	return { ...rule, valueName };
}

/** A config's rules: each also picks one of the named values (a new rule picks the first). */
function ConfigRulesEditor({
	rules,
	onChange,
	groupKeys,
	valueNames,
}: {
	readonly rules: readonly ConfigRuleInput[];
	readonly onChange: (rules: ConfigRuleInput[]) => void;
	readonly groupKeys: readonly string[];
	readonly valueNames: readonly string[];
}): React.JSX.Element {
	const newRule = React.useCallback((index: number): ConfigRuleInput => ({ ...newFlagRule(index), valueName: firstName(valueNames) }), [valueNames]);
	const valueChoice = React.useMemo((): ValueChoice<ConfigRuleInput> => ({ names: valueNames, of: ruleValueOf, set: withRuleValue }), [valueNames]);
	return <RuleListEditor rules={rules} onChange={onChange} groupKeys={groupKeys} newRule={newRule} valueChoice={valueChoice} />;
}

interface ValueRowProps {
	readonly configKey: DynamicConfigKey;
	readonly index: number;
	readonly values: readonly ValueDraft[];
	readonly onChange: (values: ValueDraft[]) => void;
}

/** One named value: its name, its JSON (checked against the config's shape as it's typed), and removing it. */
function ValueRow({ configKey, index, values, onChange }: ValueRowProps): React.JSX.Element | null {
	const value = values.at(index);
	const replace = React.useCallback(
		(next: ValueDraft): void => {
			onChange(values.map((existing, position) => (position === index ? next : existing)));
		},
		[index, onChange, values],
	);
	const setName = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			if (value !== undefined) {
				replace({ ...value, name: event.target.value });
			}
		},
		[replace, value],
	);
	const setText = React.useCallback(
		(event: React.ChangeEvent<HTMLTextAreaElement>): void => {
			if (value !== undefined) {
				replace({ ...value, text: event.target.value });
			}
		},
		[replace, value],
	);
	const remove = React.useCallback((): void => {
		onChange(values.filter((_existing, position) => position !== index));
	}, [index, onChange, values]);
	if (value === undefined) {
		return null;
	}
	const id = `value-${String(index)}`;
	return (
		<div className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[14rem_1fr_auto]">
			<div className="space-y-1.5">
				<Label htmlFor={`${id}-name`}>Name</Label>
				<Input id={`${id}-name`} value={value.name} onChange={setName} />
			</div>
			<div className="space-y-1.5">
				<Label htmlFor={`${id}-json`}>Value</Label>
				<Textarea id={`${id}-json`} className="font-mono text-xs" value={value.text} aria-invalid={!isValueTextValid(configKey, value.text)} onChange={setText} />
			</div>
			<Button type="button" variant="ghost" size="icon" className="self-end" aria-label={`Remove ${value.name}`} onClick={remove}>
				<Trash2 className="size-4" />
			</Button>
		</div>
	);
}

/** The config's named values (controlled); a new one starts from the code default. */
function ValuesEditor({
	configKey,
	defaultText,
	values,
	onChange,
}: {
	readonly configKey: DynamicConfigKey;
	readonly defaultText: string;
	readonly values: readonly ValueDraft[];
	readonly onChange: (values: ValueDraft[]) => void;
}): React.JSX.Element {
	const add = React.useCallback((): void => {
		onChange([...values, { name: `value-${String(values.length + 1)}`, text: defaultText }]);
	}, [defaultText, onChange, values]);
	return (
		<>
			{values.map((value, index): React.JSX.Element => (
				<ValueRow key={`value-${String(index)}`} configKey={configKey} index={index} values={values} onChange={onChange} />
			))}
			<div>
				<Button type="button" variant="outline" size="sm" onClick={add}>
					<Plus className="size-4" />
					Add a value
				</Button>
			</div>
		</>
	);
}

function ConfigForm({ config, groupKeys }: { readonly config: DynamicConfigDetail; readonly groupKeys: readonly string[] }): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const router = useProgressRouter();
	const schema = React.useMemo(() => configFormSchema(config.key), [config.key]);
	const save = api.featureFlags.saveConfigRevision.useMutation({
		onSuccess: async (response): Promise<void> => {
			toastMessage.success({
				title: response.data.status === "LIVE" ? `${config.title}: revision ${String(response.data.number)} is live` : `${config.title}: the change waits for approval`,
			});
			await queryClient.invalidateQueries({ queryKey: RELEASES_SCOPE });
			router.push(ROUTES.releases.config(config.key));
		},
		onError: (error): void => {
			toastMutationError("Could not save the config", error);
		},
	});
	const { mutateAsync } = save;
	const defaultText = JSON.stringify(config.defaultValue, null, JSON_INDENT);
	const live = config.live?.content.kind === "CONFIG" ? config.live.content : null;
	const defaults: ConfigFormValues = {
		values:
			live === null
				? [{ name: "default", text: JSON.stringify(config.defaultValue, null, JSON_INDENT) }]
				: live.values.map((value) => ({ name: value.name, text: JSON.stringify(value.value, null, JSON_INDENT) })),
		rules: live === null ? [] : [...live.rules],
		reason: "",
	};
	const form = useForm({
		defaultValues: defaults,
		validators: { onSubmit: schema },
		onSubmit: async ({ value }): Promise<void> => {
			const parsed = schema.parse(value);
			await mutateAsync({ key: config.key, content: parsed.content, reason: parsed.reason, basedOn: config.live?.number ?? null });
		},
	});
	const submit = React.useCallback((): Promise<void> => form.handleSubmit(), [form]);
	const handleSubmit = useFormSubmitHandler(submit);
	return (
		<div className="flex flex-col gap-6">
			<header className="flex flex-col gap-1">
				<h1 className="text-2xl font-semibold tracking-tight">{`Edit: ${config.title}`}</h1>
				<p className="text-sm text-muted-foreground">Name each value a subject may get, then the rules that pick one. Never put a secret or personal data in a value.</p>
				<EnvironmentNote />
			</header>
			<form noValidate className="flex flex-col gap-6" onSubmit={handleSubmit}>
				<Card>
					<CardHeader>
						<CardTitle>Values</CardTitle>
						<CardDescription>Each value is JSON of the shape the code declares; the field below checks it as you type.</CardDescription>
					</CardHeader>
					<CardContent>
						<form.Field name="values">
							{(field) => (
								<div className="flex flex-col gap-4">
									<ValuesEditor configKey={config.key} defaultText={defaultText} values={field.state.value} onChange={field.handleChange} />
									<FieldError errors={[...field.state.meta.errors]} />
								</div>
							)}
						</form.Field>
					</CardContent>
				</Card>
				<form.Subscribe selector={selectValueNames}>
					{(valueNames) => (
						<form.Field name="rules">
							{(field) => (
								<div className="flex flex-col gap-2">
									<ConfigRulesEditor rules={field.state.value} onChange={field.handleChange} groupKeys={groupKeys} valueNames={valueNames} />
									<FieldError errors={[...field.state.meta.errors]} />
								</div>
							)}
						</form.Field>
					)}
				</form.Subscribe>
				<Card>
					<CardContent className="flex flex-col gap-4 pt-6">
						<form.Field name="reason">
							{(field) => (
								<TextField
									id="config-reason"
									label="Why (kept in the audit log)"
									value={field.state.value}
									onChange={field.handleChange}
									onBlur={field.handleBlur}
									errors={field.state.meta.errors}
									placeholder="e.g. Add the bold button style for the experiment"
								/>
							)}
						</form.Field>
						<div>
							<Button type="submit" disabled={save.isPending}>
								Save values and rules
							</Button>
						</div>
					</CardContent>
				</Card>
			</form>
		</div>
	);
}
