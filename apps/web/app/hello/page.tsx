"use client";

import { useAuth } from "@workspace/client/lib/auth";
import { authEndpoints } from "@workspace/client/lib/endpoints";
import { useCallback, useState, type JSX } from "react";

import { LogoutButton } from "@/components/logout-button";

export default function HelloPage(): JSX.Element {
	const { api } = useAuth();
	const [showDetails, setShowDetails] = useState(false);
	const toggleDetails = useCallback((): void => {
		setShowDetails((prev: boolean) => !prev);
	}, []);

	const meQuery = api.procedure(authEndpoints.me).useQuery();

	const user = meQuery.data?.data;

	if (meQuery.isLoading) {
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

	if (meQuery.error) {
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
		<div className="flex min-h-svh items-center justify-center p-8">
			<div className="w-full max-w-lg space-y-8">
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
					{user?.isSuperAdmin ? (
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
					<button onClick={toggleDetails} className="flex w-full items-center justify-between text-sm font-medium">
						Account Details
						<svg className={`size-4 transition-transform ${showDetails ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
							<path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
						</svg>
					</button>
					{showDetails && user ? (
						<div className="mt-4 space-y-2 border-t pt-4 text-sm">
							<div className="flex justify-between">
								<span className="text-muted-foreground">User ID</span>
								<span className="font-mono text-xs">{user.id}</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Active</span>
								<span>{user.isActive ? "Yes" : "No"}</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Admin Access</span>
								<span>{user.hasAdminAccess ? "Yes" : "No"}</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Created</span>
								<span>{new Date(user.createdAt).toLocaleDateString()}</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Roles</span>
								<span>{user.roles.map((r) => r.name).join(", ") || "None"}</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Permissions</span>
								<span>{user.permissions.length}</span>
							</div>
						</div>
					) : null}
				</div>

				{/* Actions */}
				<div className="flex justify-center gap-4">
					<LogoutButton variant="destructive" />
				</div>
			</div>
		</div>
	);
}
