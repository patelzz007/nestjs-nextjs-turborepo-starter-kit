"use client";

import * as React from "react";
import { CheckIcon, ChevronRightIcon, CopyIcon, LockIcon, MoreHorizontalIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { useCopyToClipboard } from "@workspace/ui/hooks/use-copy-to-clipboard";
import { Frame, FrameHeader, FramePanel, FrameTitle } from "@workspace/ui/components/frame";

import { Button } from "@workspace/ui/components/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@workspace/ui/components/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";

interface ApiKey {
	readonly id: string;
	readonly name: string;
	readonly key: string;
}

interface ApiKeyItemProps {
	readonly item: ApiKey;
	readonly onDelete: (id: string) => void;
}

const initialKeys: readonly ApiKey[] = [
	{ id: "1", name: "Production", key: "AUDO230454*242SDIFPPL" },
	{ id: "2", name: "Development", key: "DUILO30454*242SDIFUIP" },
	{ id: "3", name: "Staging", key: "IPPODAS230454*242SDI" },
];

export function Collapsible7Example(): React.JSX.Element {
	const [keys, setKeys] = useState<readonly ApiKey[]>(initialKeys);

	const handleDelete = useCallback((id: string): void => {
		setKeys((current: readonly ApiKey[]): readonly ApiKey[] => current.filter((apiKey: ApiKey): boolean => apiKey.id !== id));
	}, []);

	return (
		<div className="h-54 w-full max-w-xs">
			<Frame stacked dense spacing="sm">
				<Collapsible defaultOpen>
					<CollapsibleTrigger className="flex w-full">
						<FrameHeader className="flex grow flex-row items-center justify-between gap-1.5 py-1!">
							<ChevronRightIcon aria-hidden="true" className="size-4 text-muted-foreground transition-transform in-aria-expanded:rotate-90" />
							<FrameTitle className="text-sm font-medium">API Keys</FrameTitle>
							<Button variant="ghost" size="icon-sm" className="ml-auto hover:border-border">
								<PlusIcon aria-hidden="true" />
							</Button>
						</FrameHeader>
					</CollapsibleTrigger>
					<CollapsibleContent>
						<FramePanel>
							<div className="flex flex-col gap-2.5">
								{keys.map((item: ApiKey): React.JSX.Element => (
									<ApiKeyItem key={item.id} item={item} onDelete={handleDelete} />
								))}
							</div>
						</FramePanel>
					</CollapsibleContent>
				</Collapsible>
			</Frame>
		</div>
	);
}

function ApiKeyItem({ item, onDelete }: ApiKeyItemProps): React.JSX.Element {
	const { isCopied, copyToClipboard } = useCopyToClipboard();
	const handleCopy = useCallback((): void => {
		copyToClipboard(item.key);
	}, [copyToClipboard, item.key]);
	const handleDelete = useCallback((): void => {
		onDelete(item.id);
	}, [item.id, onDelete]);

	return (
		<div className="flex items-center justify-between gap-3.5">
			<div className="flex items-center gap-3">
				<div className="flex items-center gap-1.5">
					<div className="flex size-5.5 shrink-0 items-center justify-center rounded-sm border-2 border-border/60 bg-muted">
						<LockIcon aria-hidden="true" className="size-3.25 text-tone-green" />
					</div>
					<div className="w-10 truncate text-xs">{item.name}</div>
				</div>
				<div className="w-40 truncate rounded-md bg-muted px-2 py-1 text-xs">{item.key}</div>
			</div>
			<div className="flex shrink-0 items-center">
				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<Button variant="ghost" size="icon-xs">
								<MoreHorizontalIcon aria-hidden="true" />
							</Button>
						}
					/>
					<DropdownMenuContent align="start" className="min-w-32">
						<DropdownMenuItem onClick={handleCopy}>
							{isCopied ? <CheckIcon aria-hidden="true" className="text-tone-green" /> : <CopyIcon aria-hidden="true" />}
							<span>{isCopied ? "Copied" : "Copy key"}</span>
						</DropdownMenuItem>
						<DropdownMenuItem variant="destructive" onClick={handleDelete}>
							<TrashIcon aria-hidden="true" />
							<span>Delete</span>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</div>
	);
}
