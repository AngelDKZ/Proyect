ALTER TYPE "public"."feature_category" ADD VALUE 'pendiente';--> statement-breakpoint
CREATE TABLE "places" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_norm" text NOT NULL,
	"kind" varchar(24) NOT NULL,
	"district" text,
	"source" varchar(40) NOT NULL,
	"geom" geometry(Point, 4326) NOT NULL
);
--> statement-breakpoint
CREATE INDEX "places_geom_gist" ON "places" USING gist ("geom");