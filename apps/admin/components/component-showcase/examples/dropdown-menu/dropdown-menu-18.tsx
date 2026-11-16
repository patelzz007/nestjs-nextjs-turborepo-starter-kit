"use client";

import { Button } from "@workspace/ui/components/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";
import { BrainIcon, ChevronDownIcon, ScaleIcon, ZapIcon, type LucideIcon } from "lucide-react";
import * as React from "react";

/** A model tier: what the picker lists (generic tiers — no product names). */
interface ModelOption {
	readonly id: string;
	readonly label: string;
	readonly icon: LucideIcon;
}

const MODELS: readonly ModelOption[] = [
	{ id: "fast", label: "Fast", icon: ZapIcon },
	{ id: "balanced", label: "Balanced", icon: ScaleIcon },
	{ id: "reasoning", label: "Deep reasoning", icon: BrainIcon },
];

const TRIGGER = <Button variant="outline" size="sm" className="w-44" />;

interface ModelItemProps {
	readonly model: ModelOption;
	readonly onChoose: (id: string) => void;
}

function ModelItem({ model, onChoose }: ModelItemProps): React.JSX.Element {
	const choose = React.useCallback((): void => {
		onChoose(model.id);
	}, [model.id, onChoose]);
	const Icon = model.icon;
	return (
		<DropdownMenuItem onClick={choose}>
			<Icon aria-hidden="true" />
			<span>{model.label}</span>
		</DropdownMenuItem>
	);
}

export function DropdownMenu18Example(): React.JSX.Element {
	const [modelId, setModelId] = React.useState<string | null>(null);
	const chosen = MODELS.find((model) => model.id === modelId);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger render={TRIGGER}>
				{chosen?.label ?? "Select model"}
				<ChevronDownIcon className="ms-auto" aria-hidden="true" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-56">
				<DropdownMenuGroup>
					<DropdownMenuLabel>Model</DropdownMenuLabel>
					{MODELS.map((model): React.JSX.Element => (
						<ModelItem key={model.id} model={model} onChoose={setModelId} />
					))}
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
