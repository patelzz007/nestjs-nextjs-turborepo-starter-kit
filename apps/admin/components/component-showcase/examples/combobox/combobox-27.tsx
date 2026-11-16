"use client";

import { Button } from "@workspace/ui/components/button";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxSeparator, ComboboxTrigger } from "@workspace/ui/components/combobox";
import { Field } from "@workspace/ui/components/field";
import { cn } from "@workspace/ui/lib/core/utils";
import { BriefcaseBusinessIcon, GitBranchIcon, LayersIcon, PackageIcon, SparklesIcon, UsersIcon } from "lucide-react";
import type * as React from "react";
import { useCallback, useState } from "react";

interface EmptyTeamOption {
	readonly type: "none";
	readonly id: "no-team";
	readonly label: string;
	readonly searchText: string;
}

type TeamTone = "growth" | "platform" | "studio" | "support" | "ops";

interface TeamOption {
	readonly type: "team";
	readonly id: string;
	readonly value: string;
	readonly label: string;
	readonly tone: TeamTone;
	readonly searchText: string;
}

type TeamSelectionItem = EmptyTeamOption | TeamOption;

const NO_TEAM_OPTION: EmptyTeamOption = {
	type: "none",
	id: "no-team",
	label: "No team",
	searchText: "No team clear team remove team empty",
};

/** The team set when the example first renders. */
const GROWTH_TEAM: TeamOption = {
	type: "team",
	id: "testo-growth",
	value: "testo-growth",
	label: "Testo Growth",
	tone: "growth",
	searchText: "Testo Growth experiments lifecycle activation",
};

const TEAM_OPTIONS: readonly TeamOption[] = [
	GROWTH_TEAM,
	{ type: "team", id: "atlas-platform", value: "atlas-platform", label: "Atlas Platform", tone: "platform", searchText: "Atlas Platform infrastructure systems" },
	{ type: "team", id: "nova-studio", value: "nova-studio", label: "Nova Studio", tone: "studio", searchText: "Nova Studio design systems creative" },
	{ type: "team", id: "pulse-support", value: "pulse-support", label: "Pulse Support", tone: "support", searchText: "Pulse Support product health customer care" },
	{ type: "team", id: "orbit-ops", value: "orbit-ops", label: "Orbit Ops", tone: "ops", searchText: "Orbit Ops operations dependencies releases" },
];

const TEAM_SELECTION_OPTIONS: readonly TeamSelectionItem[] = [NO_TEAM_OPTION, ...TEAM_OPTIONS];

const TEAM_TONE_CLASS_NAME: Readonly<Record<TeamTone, string>> = {
	growth: "text-success! **:text-success!",
	platform: "text-info! **:text-info!",
	studio: "text-tone-violet! **:text-tone-violet!",
	ops: "text-warning! **:text-warning!",
	support: "text-destructive! **:text-destructive!",
};

const TRIGGER_BUTTON = <Button type="button" variant="outline" className="w-full justify-between font-normal" />;

function teamSearchText(item: TeamSelectionItem): string {
	return item.searchText;
}

function isTeamSelectionItemEqual(item: TeamSelectionItem, value: TeamSelectionItem): boolean {
	return item.id === value.id;
}

function TeamMark({ team }: { readonly team: TeamOption }): React.JSX.Element {
	const className = cn("size-4 shrink-0", TEAM_TONE_CLASS_NAME[team.tone]);

	switch (team.tone) {
		case "platform":
			return <LayersIcon className={className} />;
		case "studio":
			return <BriefcaseBusinessIcon className={className} />;
		case "ops":
			return <GitBranchIcon className={className} />;
		case "support":
			return <PackageIcon className={className} />;
		case "growth":
			return <SparklesIcon className={className} />;
	}
}

function TeamOptionRow({ option }: { readonly option: TeamSelectionItem }): React.JSX.Element {
	return (
		<span className="flex min-w-0 items-center gap-2">
			{option.type === "none" ? <UsersIcon className="size-4 shrink-0 text-muted-foreground" /> : <TeamMark team={option} />}
			<span className="truncate">{option.label}</span>
		</span>
	);
}

export function Combobox27Example(): React.JSX.Element {
	const [team, setTeam] = useState<TeamOption | null>(GROWTH_TEAM);
	const selectedTeam: TeamSelectionItem = team ?? NO_TEAM_OPTION;

	const handleTeamChange = useCallback((nextTeam: TeamSelectionItem | null): void => {
		setTeam(nextTeam?.type === "team" ? nextTeam : null);
	}, []);

	return (
		<Field className="max-w-xs">
			<Combobox
				items={TEAM_SELECTION_OPTIONS}
				value={selectedTeam}
				onValueChange={handleTeamChange}
				itemToStringValue={teamSearchText}
				isItemEqualToValue={isTeamSelectionItemEqual}
				autoHighlight>
				<ComboboxTrigger render={TRIGGER_BUTTON}>
					<TeamOptionRow option={selectedTeam} />
				</ComboboxTrigger>

				<ComboboxContent className="max-w-(--anchor-width) min-w-(--anchor-width)">
					<ComboboxInput showTrigger={false} placeholder="Select team" className="mb-1" />
					<ComboboxEmpty text="No teams found." />
					<ComboboxList>
						<ComboboxItem value={NO_TEAM_OPTION}>
							<TeamOptionRow option={NO_TEAM_OPTION} />
						</ComboboxItem>
						<ComboboxSeparator />

						{TEAM_OPTIONS.map((item: TeamOption): React.JSX.Element => (
							<ComboboxItem key={item.id} value={item}>
								<TeamOptionRow option={item} />
							</ComboboxItem>
						))}
					</ComboboxList>
				</ComboboxContent>
			</Combobox>
		</Field>
	);
}
