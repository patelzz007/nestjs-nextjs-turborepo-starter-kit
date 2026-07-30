"use client"

import { useAuth } from "@workspace/ui/lib/auth"
import { LogoutButton } from "@/components/logout-button"
import type { UserResponse } from "@workspace/shared"

export default function AdminDashboardPage() {
  const { api } = useAuth()

  const { data: response, isLoading, error } = api.useQuery<{
    readonly success: boolean
    readonly data?: UserResponse
  }>(
    ["auth", "me"],
    "/auth/me",
  )

  const user = response?.data

  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <svg className="size-8 animate-spin text-muted-foreground" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="text-center">
          <p className="text-destructive">Failed to load dashboard</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Please try logging in again.
          </p>
          <LogoutButton className="mt-4" variant="destructive" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-8">
      <div className="w-full max-w-lg space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10">
            <svg
              className="size-8 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
              />
            </svg>
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">
            Admin Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Welcome, {user?.fullName ?? "Administrator"}
          </p>
          <p className="text-xs text-muted-foreground">
            {user?.email ?? "Loading..."}
          </p>
        </div>

        {/* Status badges */}
        <div className="flex flex-wrap justify-center gap-2">
          {user?.isSuperAdmin && (
            <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">
              Super Admin
            </span>
          )}
          {user?.isEmailVerified ? (
            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
              Email Verified
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700">
              Email Not Verified
            </span>
          )}
          {user?.hasAdminAccess && (
            <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
              Admin Access
            </span>
          )}
          {user?.roles.map((role) => (
            <span
              key={role.id}
              className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700"
            >
              {role.name}
            </span>
          ))}
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border bg-card p-4 text-card-foreground shadow-xs">
            <p className="text-xs text-muted-foreground">Permissions</p>
            <p className="mt-1 text-2xl font-bold">{user?.permissions.length ?? 0}</p>
          </div>
          <div className="rounded-lg border bg-card p-4 text-card-foreground shadow-xs">
            <p className="text-xs text-muted-foreground">Roles</p>
            <p className="mt-1 text-2xl font-bold">{user?.roles.length ?? 0}</p>
          </div>
        </div>

        {/* RBAC Summary */}
        {user && user.permissions.length > 0 && (
          <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-xs">
            <h2 className="mb-3 text-sm font-medium">Permission Summary</h2>
            <div className="space-y-2">
              {user.permissions.slice(0, 8).map((perm) => (
                <div
                  key={perm.id}
                  className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-xs"
                >
                  <span className="font-medium">{perm.resource}</span>
                  <span className="text-muted-foreground">{perm.action}</span>
                </div>
              ))}
              {user.permissions.length > 8 && (
                <p className="text-center text-xs text-muted-foreground">
                  +{user.permissions.length - 8} more permissions
                </p>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-center gap-4">
          <LogoutButton variant="destructive" />
        </div>
      </div>
    </div>
  )
}
