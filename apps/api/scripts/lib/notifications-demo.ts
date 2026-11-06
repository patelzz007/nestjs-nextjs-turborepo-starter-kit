import { z } from "zod";

import type { DemoNotificationsOutcome, DemoRecipientQuery } from "../../src/contexts/notifications/application/services/demo-notifications";

export const NOTIFICATIONS_DEMO_USAGE = "pnpm --filter @workspace/api notifications:demo [--email <address>]";

const EmailArgSchema = z.email(`--email needs an email address (usage: ${NOTIFICATIONS_DEMO_USAGE})`);

/** `[--email <address>]` → who gets the demo; without it, the platform's only superadmin. Unknown flags are refused. */
export function parseDemoNotificationsArgs(argv: readonly string[]): DemoRecipientQuery {
	let email: string | null = null;
	const remaining: string[] = [...argv];
	for (let flag = remaining.shift(); flag !== undefined; flag = remaining.shift()) {
		if (flag === "--email") {
			email = remaining.shift() ?? "";
		} else if (flag.startsWith("--email=")) {
			email = flag.slice("--email=".length);
		} else {
			throw new Error(`Unknown argument: ${flag} (usage: ${NOTIFICATIONS_DEMO_USAGE})`);
		}
	}
	return email === null ? { kind: "sole-superadmin" } : { kind: "email", email: EmailArgSchema.parse(email.trim()) };
}

export interface DemoNotificationsReport {
	readonly ok: boolean;
	readonly message: string;
}

/** What the command prints for an outcome. */
export function describeDemoNotificationsOutcome(query: DemoRecipientQuery, outcome: DemoNotificationsOutcome): DemoNotificationsReport {
	switch (outcome.kind) {
		case "sent": {
			const count = outcome.notificationIds.length;
			const timing =
				outcome.handedOff === count ? "They are being delivered now." : "The API's minute maintenance run delivers them within about two minutes (the API must be running).";
			return {
				ok: true,
				message: [
					`Sent ${String(count)} notifications to ${outcome.email}: two new sign-ins, a test notification and any seeded attachments. ${timing}`,
					"See them under the bell in the admin panel and on the mobile app's notifications screen; the emails are in Mailpit (pnpm mail:latest).",
				].join("\n"),
			};
		}
		case "not-found":
			return { ok: false, message: `No account uses ${query.kind === "email" ? query.email : "that email"}. Check the address, or leave out --email to use the superadmin.` };
		case "ambiguous":
			return {
				ok: false,
				message:
					outcome.superadmins === "none"
						? "There is no superadmin yet. Pass --email <address> to choose who gets the demo."
						: "There is more than one superadmin. Pass --email <address> to choose who gets the demo.",
			};
	}
}
