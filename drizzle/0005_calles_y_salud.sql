CREATE TABLE "health_facilities" (
	"id" serial PRIMARY KEY NOT NULL,
	"renipress_code" varchar(20),
	"name" text NOT NULL,
	"type" varchar(24) NOT NULL,
	"category" varchar(8),
	"institution" text,
	"district" text,
	"address" text,
	"phone" text,
	"schedule" text,
	"emergency_24h" boolean,
	"location_method" text,
	"location_confidence" "location_confidence" DEFAULT 'media' NOT NULL,
	"geom" geometry(Point, 4326) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "street_segments" (
	"id" serial PRIMARY KEY NOT NULL,
	"street_id" integer NOT NULL,
	"seq" integer NOT NULL,
	"length_m" double precision NOT NULL,
	"hazard_aluvion" boolean DEFAULT false NOT NULL,
	"hazard_huaico" boolean DEFAULT false NOT NULL,
	"hazard_inundacion" boolean DEFAULT false NOT NULL,
	"geom" geometry(LineString, 4326) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "streets" (
	"id" serial PRIMARY KEY NOT NULL,
	"osm_id" bigint NOT NULL,
	"name" text,
	"highway" varchar(32) NOT NULL,
	"geom" geometry(LineString, 4326) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "street_segments" ADD CONSTRAINT "street_segments_street_id_streets_id_fk" FOREIGN KEY ("street_id") REFERENCES "public"."streets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "health_facilities_geom_gist" ON "health_facilities" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "street_segments_geom_gist" ON "street_segments" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "streets_geom_gist" ON "streets" USING gist ("geom");