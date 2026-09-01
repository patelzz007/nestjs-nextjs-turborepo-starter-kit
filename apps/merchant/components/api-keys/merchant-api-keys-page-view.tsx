"use client";

import { MerchantEmptyState } from "@/components/merchant-ui/empty-state";
import { MerchantPageHeader } from "@/components/merchant-ui/page-header";
import { MerchantSurfacePanel } from "@/components/merchant-ui/surface-panel";
import { stubApiMeta } from "@/lib/api-envelope";
import { useMerchantOrg } from "@/lib/merchant-root-provider";
import { useAuth } from "@workspace/client/lib/auth";
import type { MerchantApiKeySummary } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { Button } from "@workspace/ui/components/form/button";
import { Input } from "@workspace/ui/components/form/input";
import { Label } from "@workspace/ui/components/form/label";
import { KeyRound, ShieldAlert } from "lucide-react";
import * as React from "react";

interface ApiKeyRowProps {
	readonly apiKey: MerchantApiKeySummary;
	readonly isRevoking: boolean;
	readonly onRevoke: (keyId: string) => void;
}

function ApiKeyRow({ apiKey, isRevoking, onRevoke }: ApiKeyRowProps): React.JSX.Element {
	const handleRevoke = React.useCallback((): void => {
		onRevoke(apiKey.id);
	}, [apiKey.id, onRevoke]);

	return (
		<div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background px-4 py-3">
			<div>
				<p className="font-medium">{apiKey.name}</p>
				<p className="text-xs text-muted-foreground">Terminal credential</p>
			</div>
			<div className="flex items-center gap-2">
				<Badge variant={apiKey.revokedAt === null ? "secondary" : "outline"}>{apiKey.revokedAt === null ? "Active" : "Revoked"}</Badge>
				{apiKey.revokedAt === null ? (
					<Button size="sm" variant="outline" disabled={isRevoking} onClick={handleRevoke}>
						Revoke
					</Button>
				) : null}
			</div>
		</div>
	);
}

export interface MerchantApiKeysPageViewProps {
	readonly initialIsOwner: boolean;
	readonly initialKeys?: readonly MerchantApiKeySummary[];
}

export function MerchantApiKeysPageView({ initialIsOwner, initialKeys }: MerchantApiKeysPageViewProps): React.JSX.Element {
	const { api } = useAuth();
	const { merchantOrgId } = useMerchantOrg();

	const membershipsQuery = api.merchant.me.useQuery({});
	const membership = membershipsQuery.data?.data.find((row) => row.merchantOrgId === merchantOrgId);
	const isOwner = membership !== undefined ? membership.role === "OWNER" : initialIsOwner;

	const initialKeysData = React.useMemo(
		() =>
			initialKeys !== undefined
				? {
						success: true as const,
						data: [...initialKeys],
						meta: stubApiMeta(),
					}
				: undefined,
		[initialKeys],
	);

	const keysQuery = api.merchant.apiKeys.list.useQuery(
		{},
		{
			enabled: isOwner,
			initialData: initialKeysData,
		},
	);
	const keys: readonly MerchantApiKeySummary[] = keysQuery.data?.data ?? [];

	const [name, setName] = React.useState<string>("POS Terminal");
	const [createdKey, setCreatedKey] = React.useState<string | null>(null);

	const createMutation = api.merchant.apiKeys.create.useMutation({
		onSuccess: (response): void => {
			setCreatedKey(response.data.apiKey);
			void keysQuery.refetch();
		},
	});

	const revokeMutation = api.merchant.apiKeys.revoke.useMutation({
		onSuccess: (): void => {
			void keysQuery.refetch();
		},
	});

	const activeCount = keys.filter((key) => key.revokedAt === null).length;

	const handleNameChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setName(event.target.value);
	}, []);

	const handleCreateClick = React.useCallback((): void => {
		void createMutation.mutateAsync({ name });
	}, [createMutation, name]);

	const handleRevokeKey = React.useCallback(
		(keyId: string): void => {
			void revokeMutation.mutateAsync({ keyId });
		},
		[revokeMutation],
	);

	if (!isOwner) {
		return (
			<div className="space-y-8">
				<MerchantPageHeader title="POS API keys" description="Keys for redemption terminals — owner access required." />
				<MerchantEmptyState
					title="Owner access required"
					description="API key management is limited to the store owner. Contact your account owner if you need a new terminal key."
					icon={<ShieldAlert className="size-5" aria-hidden="true" />}
				/>
			</div>
		);
	}

	return (
		<div className="space-y-8">
			<MerchantPageHeader title="POS API keys" description="Create keys for in-store terminals. Each key is shown once at creation — copy it immediately." />

			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
				<MerchantSurfacePanel accent className="p-6">
					<div className="mb-4 flex items-center gap-2">
						<KeyRound className="size-4 text-primary" aria-hidden="true" />
						<h2 className="text-base font-semibold">Create key</h2>
					</div>
					<div className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="key-name">Terminal name</Label>
							<Input id="key-name" value={name} onChange={handleNameChange} placeholder="Front counter POS" />
						</div>
						<Button disabled={createMutation.isPending} onClick={handleCreateClick}>
							{createMutation.isPending ? "Creating…" : "Create API key"}
						</Button>
						{createdKey !== null ? (
							<div className="rounded-lg border border-primary/30 bg-secondary p-4">
								<p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Copy now — shown once</p>
								<p className="mt-2 font-mono text-sm break-all text-foreground">{createdKey}</p>
							</div>
						) : null}
					</div>
				</MerchantSurfacePanel>

				<MerchantSurfacePanel className="p-6">
					<div className="mb-4 flex items-center justify-between gap-3">
						<h2 className="text-base font-semibold">Active keys</h2>
						<Badge variant="secondary">{activeCount} active</Badge>
					</div>

					{keys.length === 0 ? (
						<p className="text-sm text-muted-foreground">No API keys yet. Create one for your first POS terminal.</p>
					) : (
						<div className="space-y-3">
							{keys.map((key) => (
								<ApiKeyRow key={key.id} apiKey={key} isRevoking={revokeMutation.isPending} onRevoke={handleRevokeKey} />
							))}
						</div>
					)}
				</MerchantSurfacePanel>
			</div>
		</div>
	);
}
