"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import {
	Combobox,
	ComboboxChip,
	ComboboxChips,
	ComboboxChipsInput,
	ComboboxClearAll,
	ComboboxContent,
	ComboboxCreate,
	ComboboxEmpty,
	ComboboxGroup,
	ComboboxInput,
	ComboboxItem,
	ComboboxLabel,
	ComboboxList,
	ComboboxValue,
} from "@workspace/ui/components/form/combobox";
import { toastMessage } from "@workspace/ui/components/feedback/toast";
import * as React from "react";
import { useCallback, useMemo, useState } from "react";

// ── Demo data — the page/smart layer owns every option and value (rule 9/10) ──

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
	{ value: "rb", label: "Ruby", description: "Developer happiness first" },
	{ value: "php", label: "PHP", description: "Served half the internet" },
	{ value: "swift", label: "Swift", description: "Apple's modern language" },
];

const TEAMS: readonly DemoOption[] = [
	{ value: "platform", label: "Platform", group: "Engineering" },
	{ value: "data", label: "Data", group: "Engineering" },
	{ value: "growth", label: "Growth", group: "Product" },
	{ value: "design", label: "Design", group: "Product" },
	{ value: "support", label: "Support", group: "Operations" },
	{ value: "finance", label: "Finance", group: "Operations" },
];

const DEPARTMENTS: readonly string[] = ["Engineering", "Product", "Operations"];

const SIZES: readonly ("sm" | "default" | "lg")[] = ["sm", "default", "lg"];

/** Groups `options` by `group` — pure data shaping at the smart layer (rule 10). */
function groupOptions(options: readonly DemoOption[]): readonly (readonly DemoOption[])[] {
	return DEPARTMENTS.map((department) => options.filter((option) => option.group === department)).filter((group) => group.length > 0);
}

export function ComboboxShowcase(): React.JSX.Element {
	// Single-select (controlled value).
	const [language, setLanguage] = useState<string | null>("ts");

	// Multi-select with chips (controlled array). base-ui's `value` prop is a
	// mutable `string[]`, so the state matches that contract directly.
	const [teams, setTeams] = useState<string[]>(["platform", "data"]);

	// Async demo: simulate a remote filter with a timeout (feature 1). The
	// selection is controlled too — the smart component owns the picked value.
	const [isLoading, setIsLoading] = useState(false);
	const [remoteOptions, setRemoteOptions] = useState<readonly DemoOption[]>(LANGUAGES.slice(0, 3));
	const [query, setQuery] = useState("");
	const [remoteLanguage, setRemoteLanguage] = useState<string | null>(null);

	const handleRemoteSearch = useCallback((value: string): void => {
		setQuery(value);
		setIsLoading(true);
		window.setTimeout(() => {
			const needle = value.trim().toLowerCase();
			const filtered = needle === "" ? LANGUAGES.slice(0, 3) : LANGUAGES.filter((option) => option.label.toLowerCase().includes(needle));
			setRemoteOptions(filtered);
			setIsLoading(false);
		}, 400);
	}, []);

	// Reopening the popup resets to the default options instead of re-showing
	// only the previously selected item's result. base-ui fires `onInputValueChange`
	// only on real input changes — never on open — so this reset is race-free
	// (no deferral needed; the loading row covers the refetch).
	const handleRemoteOpenChange = useCallback(
		(open: boolean): void => {
			if (open) {
				handleRemoteSearch("");
			}
		},
		[handleRemoteSearch],
	);

	// Create-new (feature 2): the smart layer owns the option list. The draft
	// query is captured via `onInputValueChange` so the create row can show it.
	const [tags, setTags] = useState<string[]>(["stable"]);
	const [tagDraft, setTagDraft] = useState("");
	const handleTagDraftChange = useCallback((value: string): void => {
		setTagDraft(value);
	}, []);
	const handleCreateTag = useCallback((value: string): void => {
		setTags((current) => (current.includes(value) ? current : [...current, value]));
		setTagDraft("");
		toastMessage.success({ title: `Created tag "${value}"` });
	}, []);

	// Max-selection guard (feature 6).
	const [frameworks, setFrameworks] = useState<string[]>([]);
	const handleMaxSelectedReached = useCallback((max: number): void => {
		toastMessage.warning({ title: `Pick at most ${max.toString()} frameworks` });
	}, []);

	const groupedTeams = useMemo(() => groupOptions(TEAMS), []);
	const languageLabel = LANGUAGES.find((option) => option.value === language)?.label ?? "";

	// value -> label map passed to base-ui's `itemToStringLabel`. Without it, a
	// single-select combobox fills the input with the raw *value* ("js") after a
	// pick instead of the label ("JavaScript") — and reopening then searches for
	// "js", which matches nothing (the "js not found" bug).
	const labelOf = useCallback((value: string): string => LANGUAGES.find((option) => option.value === value)?.label ?? value, []);

	// Named callbacks for the formatValue / createLabel render props (rule 16:
	// no inline arrows in props — keeps them referentially stable).
	const formatLanguage = useCallback((value: string): string => `Language: ${value}`, []);
	const formatCreateTag = useCallback((value: string): string => `Create "${value}"`, []);
	const clearAllTags = useCallback((): void => {
		setTags([]);
	}, []);

	return (
		<div className="grid gap-4 px-4 py-4 lg:grid-cols-2 lg:px-6">
			{/* ── 1. Single-select with search + clear + placeholder ── */}
			<Card>
				<CardHeader>
					<CardTitle>Single select</CardTitle>
					<CardDescription>Controlled value · filter-as-you-type · clear button · size variants</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-4 sm:grid-cols-2">
					<div className="space-y-2">
						<p className="text-sm text-muted-foreground">default</p>
						<Combobox value={language} onValueChange={setLanguage} itemToStringLabel={labelOf}>
							<ComboboxInput showClear placeholder="Pick a language…" />
							<ComboboxContent>
								<ComboboxList>
									{LANGUAGES.map((option) => (
										<ComboboxItem key={option.value} value={option.value} description={option.description}>
											{option.label}
										</ComboboxItem>
									))}
									<ComboboxEmpty text="No language matches" />
								</ComboboxList>
							</ComboboxContent>
						</Combobox>
					</div>

					<div className="space-y-2">
						<p className="text-sm text-muted-foreground">size=sm · formatValue</p>
						<Combobox size="sm" value={language} onValueChange={setLanguage}>
							<ComboboxInput showClear placeholder="Pick…" />
							<ComboboxContent>
								<ComboboxList>
									{LANGUAGES.map((option) => (
										<ComboboxItem key={option.value} value={option.value}>
											{option.label}
										</ComboboxItem>
									))}
								</ComboboxList>
							</ComboboxContent>
							<ComboboxValue formatValue={formatLanguage} />
						</Combobox>
					</div>

					<p className="text-xs text-muted-foreground sm:col-span-2">
						Selected: <span className="font-medium text-foreground">{languageLabel || "none"}</span> · press <kbd className="rounded border bg-muted px-1 text-[10px]">⌘K</kbd>{" "}
						to focus
					</p>
				</CardContent>
			</Card>

			{/* ── 2. Async search with loading + create-new ── */}
			<Card>
				<CardHeader>
					<CardTitle>Async search + create-new</CardTitle>
					<CardDescription>Debounced remote filter (feature 1) · allowCreate (feature 2)</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-4">
					<div className="space-y-2">
						<p className="text-sm text-muted-foreground">Remote options with a loading row</p>
						{/* Remote search: `itemToStringLabel` keeps the input showing the
						    label after a pick (never the raw value), and `filter={null}`
						    hands all filtering to the remote layer — base-ui's built-in
						    filter must not re-filter server results against stale input. */}
						<Combobox
							value={remoteLanguage}
							onValueChange={setRemoteLanguage}
							itemToStringLabel={labelOf}
							filter={null}
							onInputValueChange={handleRemoteSearch}
							onOpenChange={handleRemoteOpenChange}
							loading={isLoading}>
							<ComboboxInput showClear placeholder="Search languages…" />
							<ComboboxContent>
								<ComboboxList>
									{remoteOptions.map((option) => (
										<ComboboxItem key={option.value} value={option.value}>
											{option.label}
										</ComboboxItem>
									))}{" "}
									{!isLoading && query.trim() !== "" && remoteOptions.length === 0 ? <ComboboxEmpty text={`Nothing matches "${query}"`} /> : null}
								</ComboboxList>
							</ComboboxContent>
						</Combobox>
						<p className="text-xs text-muted-foreground">
							Selected: <span className="font-medium text-foreground">{remoteLanguage === null ? "none" : labelOf(remoteLanguage)}</span> · value stored:{" "}
							<span className="font-mono">{remoteLanguage ?? "—"}</span>
						</p>
					</div>

					<div className="space-y-2">
						<p className="text-sm text-muted-foreground">Create-new tags (multi)</p>
						<div className="flex items-center gap-2">
							<Combobox multiple value={tags} onValueChange={setTags} maxChips={3} onInputValueChange={handleTagDraftChange}>
								<ComboboxChips>
									{tags.map((tag) => (
										<ComboboxChip key={tag}>{tag}</ComboboxChip>
									))}
									<ComboboxChipsInput placeholder="Add a tag…" />
								</ComboboxChips>
								<ComboboxContent>
									<ComboboxList>
										{tags.map((tag) => (
											<ComboboxItem key={tag} value={tag}>
												{tag}
											</ComboboxItem>
										))}
										{tagDraft.trim() !== "" && !tags.includes(tagDraft.trim()) ? (
											<ComboboxCreate query={tagDraft.trim()} createLabel={formatCreateTag} onCreate={handleCreateTag} />
										) : null}
										<ComboboxEmpty text="Type to create a new tag" />
									</ComboboxList>
								</ComboboxContent>
							</Combobox>
							{tags.length > 0 ? <ComboboxClearAll onClick={clearAllTags} /> : null}
						</div>
						<p className="text-xs text-muted-foreground">Tags: {tags.length === 0 ? "none" : tags.join(", ")} · maxChips=3 collapses extras into “+N more”</p>
					</div>
				</CardContent>
			</Card>

			{/* ── 3. Grouped multi-select with maxSelected + chips ── */}
			<Card>
				<CardHeader>
					<CardTitle>Grouped multi-select</CardTitle>
					<CardDescription>Groups · maxSelected guard (feature 6) · per-chip remove labels</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-4">
					<Combobox multiple value={teams} onValueChange={setTeams} maxSelected={4} onMaxSelectedReached={handleMaxSelectedReached}>
						<ComboboxChips>
							{teams.map((team) => (
								<ComboboxChip key={team}>{team}</ComboboxChip>
							))}
						</ComboboxChips>
						<ComboboxContent>
							<ComboboxList>
								{groupedTeams.map((group) => (
									<ComboboxGroup key={group[0]?.value}>
										<ComboboxLabel>{group[0]?.group}</ComboboxLabel>
										{group.map((option) => (
											<ComboboxItem key={option.value} value={option.value} description={option.group}>
												{option.label}
											</ComboboxItem>
										))}
									</ComboboxGroup>
								))}
								<ComboboxEmpty text="No team matches" />
							</ComboboxList>
						</ComboboxContent>
					</Combobox>
					<p className="text-xs text-muted-foreground">
						Selected: {teams.length === 0 ? "none" : teams.join(", ")} · cap: 4 — {teams.length}/4
					</p>
				</CardContent>
			</Card>

			{/* ── 4. Max-selected + disabled + sizes gallery ── */}
			<Card>
				<CardHeader>
					<CardTitle>Guards, sizes &amp; states</CardTitle>
					<CardDescription>maxSelected · disabled · sm/default/lg density</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-4">
					<div className="space-y-2">
						<p className="text-sm text-muted-foreground">maxSelected=2 — further picks are blocked</p>
						<Combobox multiple value={frameworks} onValueChange={setFrameworks} maxSelected={2} onMaxSelectedReached={handleMaxSelectedReached}>
							<ComboboxChips>
								{frameworks.map((framework) => (
									<ComboboxChip key={framework}>{framework}</ComboboxChip>
								))}
							</ComboboxChips>
							<ComboboxContent>
								<ComboboxList>
									<ComboboxItem value="react">React</ComboboxItem>
									<ComboboxItem value="vue">Vue</ComboboxItem>
									<ComboboxItem value="svelte">Svelte</ComboboxItem>
									<ComboboxItem value="solid">Solid</ComboboxItem>
								</ComboboxList>
							</ComboboxContent>
						</Combobox>
						<p className="text-xs text-muted-foreground">Selected: {frameworks.length === 0 ? "none" : frameworks.join(", ")}</p>
					</div>

					<div className="space-y-2">
						<p className="text-sm text-muted-foreground">disabled</p>
						<Combobox>
							<ComboboxInput disabled showClear placeholder="Locked for this role" />
						</Combobox>
					</div>

					<div className="grid gap-3 sm:grid-cols-3">
						{SIZES.map((size) => (
							<div key={size} className="space-y-1.5">
								<p className="text-xs text-muted-foreground">{size}</p>
								<Combobox size={size}>
									<ComboboxInput placeholder="Pick…" />
									<ComboboxContent>
										<ComboboxList>
											<ComboboxItem value="a">Option A</ComboboxItem>
											<ComboboxItem value="b">Option B</ComboboxItem>
										</ComboboxList>
									</ComboboxContent>
								</Combobox>
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
