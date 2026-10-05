CREATE TABLE "chatbot_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"role" varchar(10) NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chatbot_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" integer NOT NULL,
	"title" varchar(100) DEFAULT 'Nueva conversacion' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chatbot_message" ADD CONSTRAINT "chatbot_message_session_id_chatbot_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chatbot_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatbot_session" ADD CONSTRAINT "chatbot_session_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_chatbot_message_session" ON "chatbot_message" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_chatbot_session_student" ON "chatbot_session" USING btree ("student_id");