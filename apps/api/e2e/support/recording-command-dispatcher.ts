import type { FactoryProvider } from "@nestjs/common";
import { CommandBus, type Command } from "@nestjs/cqrs";

import type { SystemCommandOrigin } from "../../src/platform/application/ports/command-audit.port";
import type { SystemCommandDispatcher } from "../../src/platform/application/system-command-dispatcher";

/** One dispatch: the command and where it came from. */
export interface RecordedDispatch {
	readonly command: object;
	readonly origin: SystemCommandOrigin;
}

/**
 * Dispatches on the real command bus and records each command with its origin, for job specs.
 * The dispatcher's own audit row is `SystemCommandDispatcher`'s spec.
 */
export class RecordingCommandDispatcher implements Pick<SystemCommandDispatcher, "dispatch"> {
	public readonly dispatched: RecordedDispatch[] = [];

	public constructor(private readonly commandBus: CommandBus) {}

	public dispatch<TResult>(command: Command<TResult>, origin: SystemCommandOrigin): Promise<TResult> {
		this.dispatched.push({ command, origin });
		return this.commandBus.execute(command);
	}
}

/** Registers the dispatcher in a testing module, over that module's command bus. */
export const RECORDING_COMMAND_DISPATCHER: FactoryProvider<RecordingCommandDispatcher> = {
	provide: RecordingCommandDispatcher,
	inject: [CommandBus],
	useFactory: (commandBus: CommandBus): RecordingCommandDispatcher => new RecordingCommandDispatcher(commandBus),
};
