CREATE INDEX `idx_placa_original` ON `vehicles` (`placaOriginal`);--> statement-breakpoint
CREATE INDEX `idx_placa_ostentada` ON `vehicles` (`placaOstentada`);--> statement-breakpoint
CREATE INDEX `idx_status` ON `vehicles` (`devolvido`,`statusPericia`);--> statement-breakpoint
CREATE INDEX `idx_created_at` ON `vehicles` (`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_numero_processo` ON `vehicles` (`numeroProcesso`);--> statement-breakpoint
CREATE INDEX `idx_numero_procedimento` ON `vehicles` (`numeroProcedimento`);