"use client";

import { useForm } from "@tanstack/react-form";
import { LIST_SLOT_INDEX } from "@workspace/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Button } from "@workspace/ui/components/button";
import { Field, FieldContent, FieldError, FieldLabel } from "@workspace/ui/components/field";
import {
	Select,
	SelectArrow,
	SelectChip,
	SelectChips,
	SelectClear,
	SelectClearAll,
	SelectContent,
	SelectEmpty,
	SelectGroup,
	SelectItem,
	SelectLabel,
	type SelectOption,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
} from "@workspace/ui/components/select";
import { toastMessage } from "@workspace/ui/components/toast";
import * as React from "react";
import { useCallback, useState } from "react";
import { z } from "zod";

import { useFormSubmitHandler } from "@/components/common/form-fields";

// ── Demo data — the smart layer owns every option and value (rule 9/10) ─────

interface DemoOption {
	readonly value: string;
	readonly label: string;
	readonly description?: string;
	readonly group?: string;
}

const LANGUAGES: readonly DemoOption[] = [
	{ value: "ts", label: "TypeScript", description: "Strict, typed superset of JS" },
	{ value: "js", label: "JavaScript", description: "The web's lingua franca" },
	{ value: "py", label: "Python", description: "Batteries included" },
	{ value: "go", label: "Go", description: "Fast, simple, concurrent" },
	{ value: "rs", label: "Rust", description: "Memory-safe systems language" },
];

const TEAMS: readonly DemoOption[] = [
	{ value: "platform", label: "Platform", group: "Engineering" },
	{ value: "data", label: "Data", group: "Engineering" },
	{ value: "growth", label: "Growth", group: "Product" },
	{ value: "design", label: "Design", group: "Product" },
	{ value: "support", label: "Support", group: "Operations" },
];

/** Generic two-option list for the size / disabled / width demos. */
const DEMO_OPTIONS: readonly SelectOption<string>[] = [
	{ value: "a", label: "Option A" },
	{ value: "b", label: "Option B" },
];

/** The single-option list for the disabled / width demos. */
const SINGLE_DEMO_OPTION: SelectOption<string> = { value: "a", label: "Option A" };
const SINGLE_DEMO_OPTIONS: readonly SelectOption<string>[] = [SINGLE_DEMO_OPTION];

const ENVIRONMENTS: readonly SelectOption<string>[] = [
	{ value: "prod", label: "Production" },
	{ value: "staging", label: "Staging" },
];

/** The roles demo: empty until "Create role" adds the custom role. */
const CUSTOM_ROLE: SelectOption<string> = { value: "custom", label: "Custom role" };
const REMOVE_ROLE: SelectOption<string> = { value: "none", label: "Remove role" };
const ROLE_OPTIONS: readonly SelectOption<string>[] = [CUSTOM_ROLE, REMOVE_ROLE];
const NO_OPTIONS: readonly SelectOption<string>[] = [];

/** The label of `value` in `options`, or `fallback` when nothing is selected. */
function optionLabel(options: readonly SelectOption<string>[], value: string | null, fallback: string): string {
	return options.find((option) => option.value === value)?.label ?? fallback;
}

const DEPARTMENTS: readonly string[] = ["Engineering", "Product", "Operations"];

const SIZES: readonly ("sm" | "default" | "lg")[] = ["sm", "default", "lg"];

/** Groups `options` by `group` — pure data shaping at the smart layer (rule 10). */
function groupOptions(options: readonly DemoOption[]): readonly (readonly DemoOption[])[] {
	return DEPARTMENTS.map((department) => options.filter((option) => option.group === department)).filter((group) => group.length > 0);
}

/** Zod schema for the TanStack Form demo — lives at the smart/page layer (rule 18: validation is external). */
const teamFormSchema = z.object({
	language: z.string().min(1, "Pick a language"),
	teams: z.array(z.string()).min(2, "Pick at least 2 teams"),
});

type TeamFormValues = z.infer<typeof teamFormSchema>;

const teamFormDefaultValues: TeamFormValues = { language: "", teams: [] };

/** Named render-prop (rule 16: no inline arrows in props). */
function formatTeamLabel(value: string): string {
	return TEAMS.find((option) => option.value === value)?.label ?? value;
}

export function SelectShowcase(): React.JSX.Element {
	// Single-select (controlled value).
	const [language, setLanguage] = useState<string | null>("ts");
	// `items={LANGUAGES}` on each Select is what makes the trigger show the
	// label ("TypeScript"), never the raw value ("ts").
	const languageLabel = optionLabel(LANGUAGES, language, "none");

	// Clear: the smart component owns the outcome (rule 9/10) — set value to null.
	const handleClearLanguage = useCallback((): void => {
		setLanguage(null);
	}, []);

	// Empty + CTA (feature 2): the smart component owns the "create" outcome.
	const [role, setRole] = useState<string | null>(null);
	const [hasCustomRole, setHasCustomRole] = useState<boolean>(false);
	const roleOptions = hasCustomRole ? ROLE_OPTIONS : NO_OPTIONS;
	const handleCreateRole = useCallback((): void => {
		setHasCustomRole(true);
		setRole(CUSTOM_ROLE.value);
		toastMessage.success({ title: "Created a custom role (demo)" });
	}, []);

	// Grouped select (improvement 15).
	const [team, setTeam] = useState<string | null>("platform");
	const groupedTeams = React.useMemo(() => groupOptions(TEAMS), []);

	// ── Multi-select (feature: multiple) ──────────────────────────────────────
	// `items={TEAMS}` labels the trigger and live region; `formatTeamLabel` (a
	// module-scope, referentially stable function) labels the chips.
	const [teams, setTeams] = useState<string[]>(["platform", "data"]);
	const removeTeam = useCallback((value: string): void => {
		setTeams((current) => current.filter((item) => item !== value));
	}, []);
	const clearTeams = useCallback((): void => {
		setTeams([]);
	}, []);

	return (
		<div className="grid gap-4 px-4 py-4 lg:grid-cols-2 lg:px-6">
			{/* ── 1. Single select: placeholder, clear, sizes, shortcut ── */}
			<Card>
				<CardHeader>
					<CardTitle>Single select</CardTitle>
					<CardDescription>Controlled value · placeholder · clear button · size variants · ⌘K shortcut</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-4 sm:grid-cols-2">
					<div className="space-y-2">
						<p className="text-sm text-muted-foreground">default · clearable</p>
						<Select items={LANGUAGES} value={language} onValueChange={setLanguage} shortcut="⌘K">
							<SelectTrigger>
								<SelectValue placeholder="Pick a language…" />
								{language !== null ? <SelectClear onClear={handleClearLanguage} /> : null}
							</SelectTrigger>
							<SelectContent>
								{LANGUAGES.map((option) => (
									<SelectItem key={option.value} value={option.value} {...(option.description !== undefined ? { description: option.description } : {})}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<p className="text-xs text-muted-foreground">
							Selected: <span className="font-medium text-foreground">{languageLabel}</span> · value stored: <span className="font-mono">{language ?? "—"}</span> · press{" "}
							<kbd className="rounded border bg-muted px-1 text-[10px]">⌘K</kbd>
						</p>
					</div>

					<div className="space-y-2">
						<p className="text-sm text-muted-foreground">size gallery</p>
						<div className="grid gap-3">
							{SIZES.map((size) => (
								<div key={size} className="flex items-center gap-2">
									<span className="w-14 shrink-0 text-xs text-muted-foreground">{size}</span>
									<Select items={DEMO_OPTIONS} size={size}>
										<SelectTrigger>
											<SelectValue placeholder="Pick…" />
										</SelectTrigger>
										<SelectContent>
											{DEMO_OPTIONS.map((option) => (
												<SelectItem key={option.value} value={option.value}>
													{option.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							))}
						</div>
					</div>
				</CardContent>
			</Card>

			{/* ── 2. Empty state with CTA + destructive item + arrow ── */}
			<Card>
				<CardHeader>
					<CardTitle>Empty, destructive &amp; arrow</CardTitle>
					<CardDescription>Zero-option CTA (feature 2) · destructive item (feature 9) · popup arrow (feature 13)</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-4">
					<div className="space-y-2">
						<p className="text-sm text-muted-foreground">Roles — empty until you create one</p>
						<Select items={roleOptions} value={role} onValueChange={setRole}>
							<SelectTrigger>
								<SelectValue placeholder="Assign a role…" />
							</SelectTrigger>
							<SelectContent>
								<SelectArrow />
								{hasCustomRole ? (
									<>
										<SelectItem value={CUSTOM_ROLE.value}>{CUSTOM_ROLE.label}</SelectItem>
										<SelectSeparator />
										<SelectItem value={REMOVE_ROLE.value} variant="destructive">
											{REMOVE_ROLE.label}
										</SelectItem>
									</>
								) : null}
								<SelectEmpty text="No roles match" actionLabel="Create role" onAction={handleCreateRole} />
							</SelectContent>
						</Select>
						<p className="text-xs text-muted-foreground">
							Selected: <span className="font-medium text-foreground">{optionLabel(roleOptions, role, "none")}</span>
						</p>
					</div>
				</CardContent>
			</Card>

			{/* ── 3. Grouped select ── */}
			<Card>
				<CardHeader>
					<CardTitle>Grouped select</CardTitle>
					<CardDescription>Groups + labels (improvement 20) · separators</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-4">
					<Select items={TEAMS} value={team} onValueChange={setTeam}>
						<SelectTrigger>
							<SelectValue placeholder="Pick a team…" />
						</SelectTrigger>
						<SelectContent>
							{groupedTeams.map((group) => (
								<SelectGroup key={group[LIST_SLOT_INDEX.first]?.group}>
									<SelectLabel>{group[LIST_SLOT_INDEX.first]?.group}</SelectLabel>
									{group.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectGroup>
							))}
						</SelectContent>
					</Select>
					<p className="text-xs text-muted-foreground">
						Selected: <span className="font-medium text-foreground">{optionLabel(TEAMS, team, "none")}</span>
					</p>
				</CardContent>
			</Card>

			{/* ── 4. Loading + disabled + fullWidth ── */}
			<Card>
				<CardHeader>
					<CardTitle>Loading, disabled &amp; full-width</CardTitle>
					<CardDescription>Spinner row (feature 1) · disabled passthrough · full-width trigger by default (feature 11)</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-4">
					<div className="space-y-2">
						<p className="text-sm text-muted-foreground">loading — options arrive later</p>
						<Select items={ENVIRONMENTS} loading>
							<SelectTrigger>
								<SelectValue placeholder="Fetching environments…" />
							</SelectTrigger>
							<SelectContent loadingLabel="Fetching environments…">
								{ENVIRONMENTS.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<p className="text-sm text-muted-foreground">disabled</p>
						<Select items={SINGLE_DEMO_OPTIONS} disabled>
							<SelectTrigger>
								<SelectValue placeholder="Locked for this role" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={SINGLE_DEMO_OPTION.value}>{SINGLE_DEMO_OPTION.label}</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<p className="text-sm text-muted-foreground">full width (default)</p>
						<Select items={SINGLE_DEMO_OPTIONS}>
							<SelectTrigger>
								<SelectValue placeholder="This trigger stretches…" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={SINGLE_DEMO_OPTION.value}>{SINGLE_DEMO_OPTION.label}</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<p className="text-sm text-muted-foreground">compact (fullWidth=false)</p>
						<Select items={SINGLE_DEMO_OPTIONS}>
							<SelectTrigger fullWidth={false}>
								<SelectValue placeholder="Fits content…" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={SINGLE_DEMO_OPTION.value}>{SINGLE_DEMO_OPTION.label}</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</CardContent>
			</Card>

			{/* ── 5. Multi-select with chips ── */}
			<Card>
				<CardHeader>
					<CardTitle>Multi-select</CardTitle>
					<CardDescription>multiple · chips with per-chip remove · clear all · maxChips collapse</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-4">
					<div className="space-y-2">
						<p className="text-sm text-muted-foreground">Teams (maxChips=2)</p>
						<div className="flex items-center gap-2">
							<Select multiple items={TEAMS} value={teams} onValueChange={setTeams}>
								<SelectTrigger>
									{teams.length > 0 ? (
										<SelectChips maxChips={2}>
											{teams.map((value) => (
												<SelectChip key={value} value={value} label={formatTeamLabel(value)} onRemove={removeTeam} />
											))}
										</SelectChips>
									) : (
										<SelectValue placeholder="Pick teams…" />
									)}
								</SelectTrigger>
								<SelectContent>
									{TEAMS.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{teams.length > 0 ? <SelectClearAll onClearAll={clearTeams} /> : null}
						</div>{" "}
						<p className="text-xs text-muted-foreground">
							Selected: {teams.length === 0 ? "none" : teams.map(formatTeamLabel).join(", ")} — chips beyond 2 collapse into “+N”
						</p>
					</div>
				</CardContent>
			</Card>

			{/* ── 6. TanStack Form + zod (rule 18) ── */}
			<TeamAssignmentForm />
		</div>
	);
}

/**
 * TanStack Form + zod (rule 18): both selects are controlled `form.Field`s, the schema validates on
 * change and on submit, and clearing a field re-validates at once (the min-length error comes back,
 * as a form user expects from a clear affordance). The chips edit the form's value, not the demo's
 * standalone state (rule 9/10).
 */
function TeamAssignmentForm(): React.JSX.Element {
	const form = useForm({
		defaultValues: teamFormDefaultValues,
		validators: { onChange: teamFormSchema, onSubmit: teamFormSchema },
		onSubmit: ({ value, formApi }): void => {
			toastMessage.success({ title: `Saved: ${value.language} · ${value.teams.join(", ")}` });
			formApi.reset(teamFormDefaultValues);
		},
	});
	const submit = useCallback((): Promise<void> => form.handleSubmit(), [form]);
	const handleFormSubmit = useFormSubmitHandler(submit);

	const clearLanguageField = useCallback((): void => {
		form.setFieldValue("language", "");
	}, [form]);
	// The single select reports `null` once cleared; the form keeps the schema's empty-string default instead.
	const handleLanguageChange = useCallback(
		(value: string | null): void => {
			form.setFieldValue("language", value ?? "");
		},
		[form],
	);
	const removeFormTeam = useCallback(
		(value: string): void => {
			form.setFieldValue("teams", (current: string[]): string[] => current.filter((item) => item !== value));
		},
		[form],
	);
	const clearFormTeams = useCallback((): void => {
		form.setFieldValue("teams", []);
	}, [form]);

	return (
		<Card>
			<CardHeader>
				<CardTitle>TanStack Form + zod</CardTitle>
				<CardDescription>Controlled fields · Standard Schema validation · aria-invalid + FieldError · clear resets + re-validates</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleFormSubmit} className="grid gap-4" noValidate>
					<form.Field name="language">
						{(field) => (
							<Field>
								<FieldLabel>Language</FieldLabel>
								<FieldContent>
									<Select items={LANGUAGES} value={field.state.value} onValueChange={handleLanguageChange} invalid={field.state.meta.errors.length > 0} ariaLabel="Language">
										<SelectTrigger>
											<SelectValue placeholder="Pick a language…" />
											{field.state.value !== "" ? <SelectClear onClear={clearLanguageField} /> : null}
										</SelectTrigger>
										<SelectContent>
											{LANGUAGES.map((option) => (
												<SelectItem key={option.value} value={option.value}>
													{option.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<FieldError errors={field.state.meta.errors} />
								</FieldContent>
							</Field>
						)}
					</form.Field>

					<form.Field name="teams">
						{(field) => (
							<Field>
								<FieldLabel>Teams (min 2)</FieldLabel>
								<FieldContent>
									<div className="flex items-center gap-2">
										<Select multiple items={TEAMS} value={field.state.value} onValueChange={field.handleChange} invalid={field.state.meta.errors.length > 0} ariaLabel="Teams">
											<SelectTrigger>
												{field.state.value.length > 0 ? (
													<SelectChips>
														{field.state.value.map((value) => (
															<SelectChip key={value} value={value} label={formatTeamLabel(value)} onRemove={removeFormTeam} />
														))}
													</SelectChips>
												) : (
													<SelectValue placeholder="Pick teams…" />
												)}
											</SelectTrigger>
											<SelectContent>
												{TEAMS.map((option) => (
													<SelectItem key={option.value} value={option.value}>
														{option.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
										{field.state.value.length > 0 ? <SelectClearAll onClearAll={clearFormTeams} /> : null}
									</div>
									<FieldError errors={field.state.meta.errors} />
								</FieldContent>
							</Field>
						)}
					</form.Field>

					<div className="flex items-center justify-end gap-2">
						<form.Subscribe selector={selectIsSubmitting}>
							{(isSubmitting) => (
								<Button type="submit" disabled={isSubmitting}>
									{isSubmitting ? "Saving…" : "Save assignment"}
								</Button>
							)}
						</form.Subscribe>
					</div>
				</form>
			</CardContent>
		</Card>
	);
}

/** The slice of form state the submit button follows. */
function selectIsSubmitting(state: { readonly isSubmitting: boolean }): boolean {
	return state.isSubmitting;
}
