"use client";

import { zodResolver } from "@hookform/resolvers/zod";
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
	SelectSeparator,
	SelectTrigger,
	SelectValue,
} from "@workspace/ui/components/select";
import { toast } from "sonner";
import * as React from "react";
import { useCallback, useState } from "react";
import { Controller, useForm, type ControllerFieldState, type ControllerRenderProps } from "react-hook-form";
import { z } from "zod";

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

const DEPARTMENTS: readonly string[] = ["Engineering", "Product", "Operations"];

const SIZES: readonly ("sm" | "default" | "lg")[] = ["sm", "default", "lg"];

/** Groups `options` by `group` — pure data shaping at the smart layer (rule 10). */
function groupOptions(options: readonly DemoOption[]): readonly (readonly DemoOption[])[] {
	return DEPARTMENTS.map((department) => options.filter((option) => option.group === department)).filter((group) => group.length > 0);
}

/** Zod schema for the RHF demo — lives at the smart/page layer (rule 18: validation is external). */
const teamFormSchema = z.object({
	language: z.string().min(1, "Pick a language"),
	teams: z.array(z.string()).min(2, "Pick at least 2 teams"),
});

type TeamFormValues = z.infer<typeof teamFormSchema>;

const TEAM_VALUES: readonly string[] = ["platform", "data", "growth", "design", "support"];

const teamFormDefaultValues: TeamFormValues = { language: "", teams: [] };

/** Named render-prop (rule 16: no inline arrows in props). */
function formatTeamLabel(value: string): string {
	return TEAMS.find((option) => option.value === value)?.label ?? value;
}

export function SelectShowcase(): React.JSX.Element {
	// Single-select (controlled value).
	const [language, setLanguage] = useState<string | null>("ts");
	const languageLabel = LANGUAGES.find((option) => option.value === language)?.label ?? "none";

	// value → label map so the trigger shows the label, never the raw value.
	const labelOf = useCallback((value: string): string => LANGUAGES.find((option) => option.value === value)?.label ?? value, []);

	// Clear: the smart component owns the outcome (rule 9/10) — set value to null.
	const handleClearLanguage = useCallback((): void => {
		setLanguage(null);
	}, []);

	// Empty + CTA (feature 2): the smart component owns the "create" outcome.
	const [role, setRole] = useState<string | null>(null);
	const handleCreateRole = useCallback((): void => {
		setRole("custom");
		toast.success("Created a custom role (demo)");
	}, []);

	// Grouped select (improvement 15).
	const [team, setTeam] = useState<string | null>("platform");
	const groupedTeams = React.useMemo(() => groupOptions(TEAMS), []);

	// ── Multi-select (feature: multiple) ──────────────────────────────────────
	// `formatTeamLabel` is a module-scope function — referentially stable, so it
	// satisfies `itemToStringLabel` directly (no extra useCallback wrapper).
	const [teams, setTeams] = useState<string[]>(["platform", "data"]);
	const removeTeam = useCallback((value: string): void => {
		setTeams((current) => current.filter((item) => item !== value));
	}, []);
	const clearTeams = useCallback((): void => {
		setTeams([]);
	}, []);

	// ── RHF + zod (rule 18) ──────────────────────────────────────────────────
	const {
		control,
		handleSubmit,
		reset,
		setValue,
		getValues,
		formState: { errors, isSubmitting },
	} = useForm<TeamFormValues>({
		resolver: zodResolver(teamFormSchema),
		defaultValues: teamFormDefaultValues,
	});

	// Chip removal inside the RHF card mutates the *form* field, not the demo's
	// standalone `teams` state (rule 9/10: the smart component owns the data).
	// `getValues` reads the live form state and is referentially stable, so this
	// callback stays stable for the memoized `SelectChip` (rule 16).
	const removeFormTeam = useCallback(
		(value: string): void => {
			setValue(
				"teams",
				getValues("teams").filter((item) => item !== value),
				{ shouldValidate: true },
			);
		},
		[getValues, setValue],
	);

	const clearFormTeams = useCallback((): void => {
		setValue("teams", [], { shouldValidate: true });
	}, [setValue]);

	const onSubmit = useCallback(
		(values: TeamFormValues): void => {
			toast.success(`Saved: ${values.language} · ${values.teams.join(", ")}`);
			reset(teamFormDefaultValues);
		},
		[reset],
	);

	// RHF's `handleSubmit` returns a promise; the form's onSubmit expects a void
	// callback, so delegate explicitly (rule 15: explicit return type).
	const handleFormSubmit = useCallback(
		(event: React.SyntheticEvent<HTMLFormElement>): void => {
			void handleSubmit(onSubmit)(event);
		},
		[handleSubmit, onSubmit],
	);

	// Clearing the RHF language field resets it to the schema's empty-string
	// default and re-validates immediately — the min(1) error reappears (the
	// exact behaviour a form user expects from a clear affordance).
	const clearLanguageField = useCallback((): void => {
		setValue("language", "", { shouldValidate: true });
	}, [setValue]);

	// Named render-props for the two Controller fields (rule 16: no inline
	// arrows in props). Each returns the controlled Select for its field.
	const renderLanguageField = useCallback(
		({ field, fieldState }: { readonly field: ControllerRenderProps<TeamFormValues, "language">; readonly fieldState: ControllerFieldState }): React.JSX.Element => (
			<Select value={field.value} onValueChange={field.onChange} itemToStringLabel={labelOf} invalid={fieldState.invalid} ariaLabel="Language">
				<SelectTrigger>
					<SelectValue placeholder="Pick a language…" />
					{field.value !== "" ? <SelectClear onClear={clearLanguageField} /> : null}
				</SelectTrigger>
				<SelectContent>
					{LANGUAGES.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		),
		[labelOf, clearLanguageField],
	);

	const renderTeamsField = useCallback(
		({ field, fieldState }: { readonly field: ControllerRenderProps<TeamFormValues, "teams">; readonly fieldState: ControllerFieldState }): React.JSX.Element => (
			<div className="flex items-center gap-2">
				<Select multiple value={field.value} onValueChange={field.onChange} itemToStringLabel={formatTeamLabel} invalid={fieldState.invalid} ariaLabel="Teams">
					<SelectTrigger>
						{field.value.length > 0 ? (
							<SelectChips>
								{field.value.map((value) => (
									<SelectChip key={value} value={value} label={formatTeamLabel(value)} onRemove={removeFormTeam} />
								))}
							</SelectChips>
						) : (
							<SelectValue placeholder="Pick teams…" />
						)}
					</SelectTrigger>
					<SelectContent>
						{TEAM_VALUES.map((value) => (
							<SelectItem key={value} value={value}>
								{formatTeamLabel(value)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				{field.value.length > 0 ? <SelectClearAll onClearAll={clearFormTeams} /> : null}
			</div>
		),
		[removeFormTeam, clearFormTeams],
	);

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
						<Select value={language} onValueChange={setLanguage} itemToStringLabel={labelOf} shortcut="⌘K">
							<SelectTrigger>
								<SelectValue placeholder="Pick a language…" />
								{language !== null ? <SelectClear onClear={handleClearLanguage} /> : null}
							</SelectTrigger>
							<SelectContent>
								{LANGUAGES.map((option) => (
									<SelectItem key={option.value} value={option.value} description={option.description}>
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
									<Select size={size}>
										<SelectTrigger>
											<SelectValue placeholder="Pick…" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="a">Option A</SelectItem>
											<SelectItem value="b">Option B</SelectItem>
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
						<Select value={role} onValueChange={setRole}>
							<SelectTrigger>
								<SelectValue placeholder="Assign a role…" />
							</SelectTrigger>
							<SelectContent>
								<SelectArrow />
								{role === "custom" ? (
									<>
										<SelectItem value="custom">Custom role</SelectItem>
										<SelectSeparator />
										<SelectItem value="none" variant="destructive">
											Remove role
										</SelectItem>
									</>
								) : null}
								<SelectEmpty text="No roles match" actionLabel="Create role" onAction={handleCreateRole} />
							</SelectContent>
						</Select>
						<p className="text-xs text-muted-foreground">
							Selected: <span className="font-medium text-foreground">{role ?? "none"}</span>
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
					<Select value={team} onValueChange={setTeam}>
						<SelectTrigger>
							<SelectValue placeholder="Pick a team…" />
						</SelectTrigger>
						<SelectContent>
							{groupedTeams.map((group) => (
								<SelectGroup key={group[0]?.group}>
									<SelectLabel>{group[0]?.group}</SelectLabel>
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
						Selected: <span className="font-medium text-foreground">{team ?? "none"}</span>
					</p>
				</CardContent>
			</Card>

			{/* ── 4. Loading + disabled + fullWidth ── */}
			<Card>
				<CardHeader>
					<CardTitle>Loading, disabled &amp; full-width</CardTitle>
					<CardDescription>Spinner row (feature 1) · disabled passthrough · w-full trigger (feature 11)</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-4">
					<div className="space-y-2">
						<p className="text-sm text-muted-foreground">loading — options arrive later</p>
						<Select loading>
							<SelectTrigger>
								<SelectValue placeholder="Fetching environments…" />
							</SelectTrigger>
							<SelectContent loadingLabel="Fetching environments…">
								<SelectItem value="prod">Production</SelectItem>
								<SelectItem value="staging">Staging</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<p className="text-sm text-muted-foreground">disabled</p>
						<Select disabled>
							<SelectTrigger>
								<SelectValue placeholder="Locked for this role" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="a">Option A</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<p className="text-sm text-muted-foreground">fullWidth</p>
						<Select>
							<SelectTrigger fullWidth>
								<SelectValue placeholder="This trigger stretches…" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="a">Option A</SelectItem>
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
							<Select multiple value={teams} onValueChange={setTeams} itemToStringLabel={formatTeamLabel}>
								<SelectTrigger fullWidth>
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
									{TEAM_VALUES.map((value) => (
										<SelectItem key={value} value={value}>
											{formatTeamLabel(value)}
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

			{/* ── 6. React Hook Form + zod (rule 18) ── */}
			<Card>
				<CardHeader>
					<CardTitle>React Hook Form + zod</CardTitle>
					<CardDescription>Controller pattern · zodResolver · aria-invalid + FieldError · clear resets + re-validates</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleFormSubmit} className="grid gap-4" noValidate>
						<Field>
							<FieldLabel>Language</FieldLabel>
							<FieldContent>
								<Controller control={control} name="language" render={renderLanguageField} />
								<FieldError>{errors.language?.message}</FieldError>
							</FieldContent>
						</Field>

						<Field>
							<FieldLabel>Teams (min 2)</FieldLabel>
							<FieldContent>
								{" "}
								<Controller control={control} name="teams" render={renderTeamsField} />
								<FieldError>{errors.teams?.message}</FieldError>
							</FieldContent>
						</Field>

						<div className="flex items-center justify-end gap-2">
							<Button type="submit" disabled={isSubmitting}>
								{isSubmitting ? "Saving…" : "Save assignment"}
							</Button>
						</div>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
