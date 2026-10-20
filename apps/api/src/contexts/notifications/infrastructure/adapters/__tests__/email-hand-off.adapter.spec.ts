import type { Command } from "@nestjs/cqrs";
import type { EmailSendJob, NotificationEmailRequestedPayload } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { createTestTypedConfig } from "../../../../../../test/support/test-api-env";
import type { SystemCommandOrigin } from "../../../../../platform/application/ports/command-audit.port";
import type { SystemCommandDispatcher } from "../../../../../platform/application/system-command-dispatcher";
import { DeliverEmailCommand } from "../../../application/commands/deliver-email/deliver-email.command";
import { EmailDeliveryAbandonedError, EmailDeliveryRetryRequestedError } from "../../../application/commands/deliver-email/deliver-email.errors";
import { EmailRequestHandOff } from "../email-hand-off.adapter";
import type { EmailQueueService } from "../email-queue.adapter";

const REQUEST: NotificationEmailRequestedPayload = { emailLogId: "6b1f3e2a-9c4d-4e5f-8a7b-1c2d3e4f5a6b", templateKey: "welcome", props: { to: "a@example.com" } };

/** The email queue: enabled or not, recording what is enqueued. */
class RecordingQueue implements Pick<EmailQueueService, "isEnabled" | "enqueue"> {
	public readonly jobs: EmailSendJob[] = [];

	public constructor(private readonly enabled: boolean) {}

	public isEnabled(): boolean {
		return this.enabled;
	}

	public enqueue(job: EmailSendJob): Promise<string> {
		this.jobs.push(job);
		return Promise.resolve(job.emailLogId);
	}
}

/** Runs the inline attempts: each scripted error is thrown by the DeliverEmail dispatch in turn; then it succeeds. */
class ScriptedCommands implements Pick<SystemCommandDispatcher, "dispatch"> {
	public readonly attempts: number[] = [];

	public constructor(private readonly errors: Error[]) {}

	public dispatch<TResult>(command: Command<TResult>, _origin: SystemCommandOrigin): Promise<TResult> {
		if (command instanceof DeliverEmailCommand) {
			this.attempts.push(command.input.attemptNumber);
		}
		const error = this.errors.shift();
		return error === undefined ? Promise.reject(new SucceededMarker()) : Promise.reject(error);
	}
}

/** Stands for a successful dispatch: the hand-off only cares that it did not throw a retry request. */
class SucceededMarker extends Error {}

function handOff(queue: RecordingQueue, commands: ScriptedCommands): EmailRequestHandOff {
	return new EmailRequestHandOff(createTestTypedConfig({ EMAIL_MAX_ATTEMPTS: "3" }), queue, commands);
}

describe("EmailRequestHandOff", () => {
	it("enqueues the request on the emailSend queue when BullMQ is on, delivering nothing inline", async () => {
		const queue = new RecordingQueue(true);
		const commands = new ScriptedCommands([]);

		await handOff(queue, commands).handOff(REQUEST);

		expect(queue.jobs).toEqual([REQUEST]);
		expect(commands.attempts).toEqual([]);
	});

	it("without Redis, delivers inline through DeliverEmail and retries while the command asks for it", async () => {
		const commands = new ScriptedCommands([new EmailDeliveryRetryRequestedError("timeout"), new EmailDeliveryRetryRequestedError("timeout")]);

		await expect(handOff(new RecordingQueue(false), commands).handOff(REQUEST)).resolves.toBeUndefined();
		expect(commands.attempts).toEqual([1, 2, 3]);
	});

	it("stops at once when the delivery is abandoned (the log row already says why)", async () => {
		const commands = new ScriptedCommands([new EmailDeliveryAbandonedError("invalid recipient")]);

		await expect(handOff(new RecordingQueue(false), commands).handOff(REQUEST)).resolves.toBeUndefined();
		expect(commands.attempts).toEqual([1]);
	});
});
