CREATE TABLE "reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reservations_status_check" CHECK (status IN ('active', 'cancelled', 'completed')),
	CONSTRAINT "reservations_end_after_start" CHECK (end_time > start_time)
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"location" text NOT NULL,
	"capacity" integer NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"amenities" text[] DEFAULT '{}'::text[] NOT NULL,
	"availability_hours" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rooms_name_not_blank" CHECK (char_length(trim(name)) > 0),
	CONSTRAINT "rooms_location_not_blank" CHECK (char_length(trim(location)) > 0),
	CONSTRAINT "rooms_capacity_positive" CHECK (capacity > 0)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_name_not_blank" CHECK (char_length(trim(name)) > 0),
	CONSTRAINT "users_role_check" CHECK (role IN ('user', 'admin'))
);
--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reservations_user_start_time_idx" ON "reservations" USING btree ("user_id","start_time");--> statement-breakpoint
CREATE INDEX "reservations_room_start_time_idx" ON "reservations" USING btree ("room_id","start_time");--> statement-breakpoint
CREATE INDEX "rooms_active_location_idx" ON "rooms" USING btree ("location") WHERE is_active;--> statement-breakpoint
CREATE INDEX "rooms_active_capacity_idx" ON "rooms" USING btree ("capacity") WHERE is_active;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_unique" ON "users" USING btree (lower(email));