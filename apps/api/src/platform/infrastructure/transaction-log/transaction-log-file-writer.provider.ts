import type { FactoryProvider } from "@nestjs/common";

import { TypedConfigService } from "../../../config/typed-config.service";
import { TransactionLogFileWriter } from "./transaction-log-file-writer";

/** Thrown when an enabled transaction-log module is wired while the config has the log off — a wiring bug, caught at boot. */
export class TransactionLogDisabledError extends Error {
	public constructor() {
		super("The transaction log file writer was wired while TRANSACTION_LOG_ENABLED is off — import TransactionLogModule.register() instead.");
		this.name = "TransactionLogDisabledError";
	}
}

/** The one file writer of an enabled transaction log, built from the validated config. */
export const TRANSACTION_LOG_FILE_WRITER_PROVIDER: FactoryProvider<TransactionLogFileWriter> = {
	provide: TransactionLogFileWriter,
	useFactory: (config: TypedConfigService): TransactionLogFileWriter => {
		const transactionLog = config.observability.transactionLog;
		if (transactionLog === null) {
			throw new TransactionLogDisabledError();
		}
		return new TransactionLogFileWriter(transactionLog);
	},
	inject: [TypedConfigService],
};
