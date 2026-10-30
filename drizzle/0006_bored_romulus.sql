PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_api_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'active' NOT NULL,
	`default_response_schema` text,
	`requests_per_minute` integer DEFAULT 10 NOT NULL,
	`requests_per_day` integer DEFAULT 100 NOT NULL,
	`tokens_per_day` integer DEFAULT 150000 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_api_projects`("id", "name", "description", "status", "default_response_schema", "requests_per_minute", "requests_per_day", "tokens_per_day", "created_at", "updated_at") SELECT "id", "name", "description", "status", "default_response_schema", "requests_per_minute", "requests_per_day", "tokens_per_day", "created_at", "updated_at" FROM `api_projects`;--> statement-breakpoint
DROP TABLE `api_projects`;--> statement-breakpoint
ALTER TABLE `__new_api_projects` RENAME TO `api_projects`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `api_projects_name_unique` ON `api_projects` (`name`);--> statement-breakpoint
CREATE INDEX `idx_api_projects_status` ON `api_projects` (`status`);--> statement-breakpoint
CREATE INDEX `idx_api_projects_created_at` ON `api_projects` (`created_at`);