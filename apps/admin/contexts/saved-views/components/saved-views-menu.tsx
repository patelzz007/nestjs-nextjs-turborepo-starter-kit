"use client";

import { useQueryClient } from "@tanstack/react-query";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { CreateSavedListViewSchema, type SavedListKey, type SavedListView } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";
import { Switch } from "@workspace/ui/components/switch";
import { toastMessage } from "@workspace/ui/components/toast";
import { Bookmark, Trash2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { toastMutationError } from "@/lib/api/mutation-error";
import { appRoute } from "@workspace/client/lib/navigation/app-route";

/** The list's URL query as a saved view keeps it (`?…`, or empty). */
export function currentQuery(search: string): string {
	return search.length === 0 ? "" : `?${search}`;
}

export interface SavedViewsMenuProps {
	readonly listKey: SavedListKey;
}

/**
 * Saved views on an admin list (enhancement 5.10): open one of your views or one another staff member shared,
 * save the filters you have now under a name (optionally for the whole team), and remove your own. A view is
 * the list's URL, so opening one is navigating to it.
 */
export function SavedViewsMenu({ listKey }: SavedViewsMenuProps): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const router = useRouter();
	const pathname = usePathname();
	const search = useSearchParams().toString();
	const [open, setOpen] = React.useState(false);
	const [name, setName] = React.useState("");
	const [shared, setShared] = React.useState(false);
	const nameId = React.useId();
	const shareId = React.useId();
	const views = api.savedViews.list.useQuery({ listKey }).data?.data.views ?? [];
	const refresh = React.useCallback(async (): Promise<void> => {
		await queryClient.invalidateQueries({ queryKey: apiRouter.savedViews.list.queryKey({ listKey }) });
	}, [listKey, queryClient]);
	const create = api.savedViews.create.useMutation({
		onSuccess: async (): Promise<void> => {
			toastMessage.success({ title: "View saved" });
			setName("");
			setShared(false);
			await refresh();
		},
		onError: (error): void => {
			toastMutationError("Could not save the view", error);
		},
	});
	const remove = api.savedViews.remove.useMutation({
		onSuccess: async (): Promise<void> => {
			toastMessage.success({ title: "View removed" });
			await refresh();
		},
		onError: (error): void => {
			toastMutationError("Could not remove the view", error);
		},
	});
	const draftValid: boolean = CreateSavedListViewSchema.safeParse({ listKey, name, query: currentQuery(search), shared }).success;
	const { mutate: mutateCreate } = create;
	const handleSave = React.useCallback(
		(event: React.SubmitEvent<HTMLFormElement>): void => {
			event.preventDefault();
			const draft = CreateSavedListViewSchema.safeParse({ listKey, name, query: currentQuery(search), shared });
			if (draft.success) {
				mutateCreate(draft.data);
			}
		},
		[listKey, mutateCreate, name, search, shared],
	);
	const handleName = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			setName(event.currentTarget.value);
		},
		[setName],
	);
	const handleOpenView = React.useCallback(
		(view: SavedListView): void => {
			setOpen(false);
			router.push(appRoute(`${pathname}${view.query}`));
		},
		[pathname, router, setOpen],
	);
	const { mutate: mutateRemove } = remove;
	const handleRemove = React.useCallback(
		(view: SavedListView): void => {
			mutateRemove({ viewId: view.id });
		},
		[mutateRemove],
	);
	const saveDisabled: boolean = !draftValid || create.isPending;

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger render={<Button type="button" variant="outline" size="sm" />}>
				<Bookmark className="size-4" aria-hidden="true" />
				Saved views
			</PopoverTrigger>
			<PopoverContent align="end" className="w-80" aria-label="Saved views on this list">
				<div className="flex flex-col gap-4">
					{views.length === 0 ? (
						<p className="text-sm text-muted-foreground">No saved views yet. Filter the list, then save it here.</p>
					) : (
						<ul className="flex flex-col gap-1" aria-label="Saved views">
							{views.map((view): React.JSX.Element => (
								<SavedViewRow key={view.id} view={view} onOpen={handleOpenView} onRemove={handleRemove} />
							))}
						</ul>
					)}
					<form className="flex flex-col gap-3 border-t border-border pt-3" onSubmit={handleSave}>
						<div className="flex flex-col gap-1.5">
							<Label htmlFor={nameId}>Save the current view as</Label>
							<Input id={nameId} value={name} onChange={handleName} placeholder="e.g. Locked out this week" />
						</div>
						<div className="flex items-center justify-between gap-3">
							<Label htmlFor={shareId}>Share with the other staff</Label>
							<Switch id={shareId} checked={shared} onCheckedChange={setShared} />
						</div>
						<Button type="submit" size="sm" disabled={saveDisabled}>
							Save view
						</Button>
					</form>
				</div>
			</PopoverContent>
		</Popover>
	);
}

function SavedViewRow({
	view,
	onOpen,
	onRemove,
}: {
	readonly view: SavedListView;
	readonly onOpen: (view: SavedListView) => void;
	readonly onRemove: (view: SavedListView) => void;
}): React.JSX.Element {
	const handleOpen = React.useCallback((): void => {
		onOpen(view);
	}, [onOpen, view]);
	const handleRemove = React.useCallback((): void => {
		onRemove(view);
	}, [onRemove, view]);
	return (
		<li className="flex items-center gap-2">
			<button type="button" onClick={handleOpen} className="flex min-w-0 flex-1 flex-col rounded-md px-2 py-1.5 text-start text-sm transition-colors hover:bg-foreground/10">
				<span className="truncate font-medium">{view.name}</span>
				{view.mine ? (
					view.shared ? (
						<span className="text-xs text-muted-foreground">Shared with the staff</span>
					) : null
				) : (
					<span className="text-xs text-muted-foreground">Shared by {view.ownerName ?? "a staff member"}</span>
				)}
			</button>
			{view.mine ? (
				<Button type="button" variant="ghost" size="icon-sm" onClick={handleRemove} aria-label={`Remove ${view.name}`}>
					<Trash2 className="size-4" aria-hidden="true" />
				</Button>
			) : null}
		</li>
	);
}
