// API path templates owned by the `operations` context (ADR 068). Composed into `apiRoutes`
// (`src/api-routes.ts`) with identical keys and values.

import type { RouteTree } from "../../route-tree";

/** Path templates composed into `apiRoutes.operations`. */
export const operationsRoutes = {
	overview: "/admin/operations/overview",
	servers: "/admin/operations/servers",
	registerServer: "/admin/operations/servers",
	server: "/admin/operations/servers/:serverId",
	serverHistory: "/admin/operations/servers/:serverId/history",
	rotateServerToken: "/admin/operations/servers/:serverId/token",
	revokeServer: "/admin/operations/servers/:serverId",
	instances: "/admin/operations/instances",
	instanceHistory: "/admin/operations/instances/:instanceId/history",
	dependencies: "/admin/operations/dependencies",
	dependencyHistory: "/admin/operations/dependencies/:dependency/history",
	alerts: "/admin/operations/alerts",
	alertSettings: "/admin/operations/alert-settings",
	updateAlertSettings: "/admin/operations/alert-settings",
	backups: "/admin/operations/backups",
	createBackup: "/admin/operations/backups",
	backupSchedule: "/admin/operations/backups/schedule",
	pinBackup: "/admin/operations/backups/:backupId/pin",
	backupDownload: "/admin/operations/backups/:backupId/download",
	deleteBackup: "/admin/operations/backups/:backupId",
	/** A backup's file for a one-time ticket (the ticket alone authorises it, like a signed URL). */
	backupFile: "/operations/backups/:backupId/file",
	loadTests: "/admin/operations/load-tests",
	startLoadTest: "/admin/operations/load-tests",
	loadTest: "/admin/operations/load-tests/:runId",
	abortLoadTest: "/admin/operations/load-tests/:runId/abort",
	loadTestCaps: "/admin/operations/load-tests/caps",
	purgeLoadTestData: "/admin/operations/load-tests/data",
	/** Where a server agent reports — authenticated by the server's own token, not a session. */
	agentReport: "/operations/agent/report",
} satisfies Record<string, RouteTree>;
