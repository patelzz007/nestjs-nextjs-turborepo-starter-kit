import type { Prisma } from "@prisma/client";

import { FileLifecycleListener, type FileVerdictEvent } from "./file-lifecycle-listener";

/** Where the registry finds the application's providers — Nest's `DiscoveryService` satisfies it (tests pass a plain list). */
export interface ListenerProviderSource {
	getProviders(): readonly { readonly instance: object | null | undefined }[];
}

/**
 * Delivers file verdicts to every {@link FileLifecycleListener} provider in the
 * application whose categories match. Listeners are discovered lazily on the
 * first verdict — after the whole module graph is instantiated — so a new
 * feature only adds a provider; nothing in the files module changes.
 *
 * Built by FilesModule's provider factory over Nest's `DiscoveryService`.
 */
export class FileLifecycleListenerRegistry {
	private discovered: readonly FileLifecycleListener[] | null = null;

	public constructor(private readonly providers: ListenerProviderSource) {}

	/** Runs every matching listener, in order, inside the caller's verdict transaction. A listener failure rolls the verdict back. */
	public async notifyInTx(tx: Prisma.TransactionClient, event: FileVerdictEvent): Promise<void> {
		for (const listener of this.listeners()) {
			if (listener.categories.includes(event.category)) {
				await listener.onVerdict(tx, event);
			}
		}
	}

	private listeners(): readonly FileLifecycleListener[] {
		this.discovered ??= this.providers
			.getProviders()
			.map((wrapper): object | null | undefined => wrapper.instance)
			.filter((instance): instance is FileLifecycleListener => instance instanceof FileLifecycleListener);
		return this.discovered;
	}
}
