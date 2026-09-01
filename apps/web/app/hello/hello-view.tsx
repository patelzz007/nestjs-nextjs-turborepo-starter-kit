"use client";

import { useAuth } from "@workspace/client/lib/auth";
import { useAuthUser, type AuthUser } from "@workspace/client/lib/auth/auth-store";
import type { Envelope, UserResponse } from "@workspace/shared";

import { useCallback, useState, type JSX } from "react";

import { format } from "date-fns";

import { Button } from "@workspace/ui/components/form/button";
import { BreadcrumbTrail } from "@/components/breadcrumb-trail";
import { ImpersonateUserPanel } from "@/components/impersonation/impersonate-user-panel";
import { ImpersonationBanner } from "@/components/impersonation/impersonation-banner";
import { LogoutButton } from "@/components/logout-button";

/** Unified user type that works with both API response and store user. */
interface DisplayUser {
	readonly id: string;
	readonly email: string;
	readonly fullName: string;
	readonly isEmailVerified: boolean;
	readonly isSuperAdmin: boolean;
	readonly hasAdminAccess: boolean;
	readonly roles: readonly { readonly id: string; readonly name: string }[];
	readonly permissions?: readonly unknown[];
	readonly isActive?: boolean;
	readonly createdAt?: number;
}

/** Convert AuthUser to DisplayUser. */
function fromStoreUser(user: AuthUser): DisplayUser {
	return {
		id: user.id,
		email: user.email,
		fullName: user.fullName,
		isEmailVerified: user.isEmailVerified,
		isSuperAdmin: user.isSuperAdmin,
		hasAdminAccess: user.hasAdminAccess,
		roles: user.roles,
	};
}

/** Convert API UserResponse to DisplayUser. */
function fromApiResponse(user: UserResponse): DisplayUser {
	return {
		id: user.id,
		email: user.email,
		fullName: user.fullName,
		isEmailVerified: user.isEmailVerified,
		isSuperAdmin: user.isSuperAdmin,
		hasAdminAccess: user.hasAdminAccess,
		roles: user.roles,
		isActive: user.isActive,
		createdAt: user.createdAt,
	};
}

export default function HelloView({ initialEnvelope }: { readonly initialEnvelope: Envelope<UserResponse> }): JSX.Element {
	const { api } = useAuth();
	const storeUser = useAuthUser();
	const [showDetails, setShowDetails] = useState(false);
	const toggleDetails = useCallback((): void => {
		setShowDetails((prev: boolean) => !prev);
	}, []);

	const meQuery = api.auth.me.useQuery(undefined, { initialData: initialEnvelope });
	const permissionsQuery = api.auth.permissions.useQuery(undefined);

	// Normalize both sources into DisplayUser, then pick the best available
	const apiUser: DisplayUser | null = meQuery.data?.data !== undefined ? fromApiResponse(meQuery.data.data) : null;
	const permissionCount: number | undefined = permissionsQuery.data?.data?.permissions.length;
	const storeUserDisplay: DisplayUser | null = storeUser !== null ? fromStoreUser(storeUser) : null;
	const user: DisplayUser | null = apiUser ?? storeUserDisplay;
	const showImpersonatePanel = user?.isSuperAdmin === true && permissionsQuery.isSuccess && permissionsQuery.data?.data?.isImpersonating !== true;

	if (meQuery.isLoading && user === null) {
		return (
			<div className="flex min-h-svh items-center justify-center">
				<div className="flex flex-col items-center gap-4">
					<svg className="size-8 animate-spin text-muted-foreground" fill="none" viewBox="0 0 24 24">
						<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
						<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
					</svg>
					<p className="text-sm text-muted-foreground">Loading your profile...</p>
				</div>
			</div>
		);
	}

	if (meQuery.error && user === null) {
		return (
			<div className="flex min-h-svh items-center justify-center">
				<div className="text-center">
					<p className="text-destructive">Failed to load profile</p>
					<p className="mt-2 text-sm text-muted-foreground">Please try logging in again.</p>
					<LogoutButton className="mt-4" variant="destructive" />
				</div>
			</div>
		);
	}

	return (
		<div className="flex min-h-svh flex-col">
			<ImpersonationBanner />
			<div className="flex flex-1 items-center justify-center p-8">
				<div className="w-full max-w-lg space-y-8">
					{/* Breadcrumb (context-driven, with mandatory icons) */}
					<BreadcrumbTrail />

					{/* Header */}
					<div className="text-center">
						<div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10">
							<svg className="size-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
								/>
							</svg>
						</div>
						<h1 className="mt-4 text-2xl font-bold tracking-tight">Welcome, {user?.fullName ?? "User"}</h1>
						<p className="mt-1 text-sm text-muted-foreground">{user?.email ?? "Loading..."}</p>
					</div>

					{/* Status badges */}
					<div className="flex flex-wrap justify-center gap-2">
						<span
							className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
								user?.isEmailVerified ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
							}`}>
							{user?.isEmailVerified ? "Email Verified" : "Email Not Verified"}
						</span>
						{user?.isSuperAdmin === true ? (
							<span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">Super Admin</span>
						) : null}
						{user?.roles.map((role) => (
							<span key={role.id} className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
								{role.name}
							</span>
						))}
					</div>

					{/* Details card */}
					<div className="rounded-lg border bg-card p-6 text-card-foreground shadow-xs">
						<Button type="button" variant="nav" onClick={toggleDetails} className="h-auto justify-between text-sm font-medium">
							Account Details
							<svg className={`size-4 transition-transform ${showDetails ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
								<path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
							</svg>
						</Button>
						{showDetails && user !== null ? (
							<div className="mt-4 space-y-2 border-t pt-4 text-sm">
								<div className="flex justify-between">
									<span className="text-muted-foreground">User ID</span>
									<span className="font-mono text-xs">{user.id}</span>
								</div>
								{"isActive" in user && user.isActive !== undefined ? (
									<div className="flex justify-between">
										<span className="text-muted-foreground">Active</span>
										<span>{user.isActive ? "Yes" : "No"}</span>
									</div>
								) : null}
								<div className="flex justify-between">
									<span className="text-muted-foreground">Admin Access</span>
									<span>{user.hasAdminAccess ? "Yes" : "No"}</span>
								</div>
								{"createdAt" in user && user.createdAt !== undefined ? (
									<div className="flex justify-between">
										<span className="text-muted-foreground">Created</span>
										<span>{format(new Date(user.createdAt), "MMM d, yyyy")}</span>
									</div>
								) : null}
								<div className="flex justify-between">
									<span className="text-muted-foreground">Roles</span>
									<span>{user.roles.map((r) => r.name).join(", ") || "None"}</span>
								</div>
								{"permissions" in user && user.permissions !== undefined ? (
									<div className="flex justify-between">
										<span className="text-muted-foreground">Permissions</span>
										<span>{user.permissions.length}</span>
									</div>
								) : permissionCount !== undefined ? (
									<div className="flex justify-between">
										<span className="text-muted-foreground">Permissions</span>
										<span>{permissionCount}</span>
									</div>
								) : null}
							</div>
						) : null}
					</div>

					{/* Actions */}
					<div className="flex justify-center gap-4">
						<LogoutButton variant="destructive" />
					</div>

					{showImpersonatePanel ? <ImpersonateUserPanel /> : null}
				</div>
			</div>
		</div>
	);
}
