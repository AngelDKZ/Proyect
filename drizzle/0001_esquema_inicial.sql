CREATE TYPE "public"."feature_category" AS ENUM('zona_modelada', 'area_evaluada', 'evento_registrado', 'zona_critica', 'susceptibilidad', 'sector_expuesto', 'aniego_recurrente', 'faja_marginal', 'cauce');--> statement-breakpoint
CREATE TYPE "public"."location_confidence" AS ENUM('alta', 'media', 'baja');--> statement-breakpoint
CREATE TYPE "public"."safe_zone_type" AS ENUM('zona_seguridad', 'refugio_temporal', 'centro_acopio', 'atencion_medica', 'puesto_comando', 'atencion_animal', 'gestion_cadaveres');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('oficial', 'municipal', 'academico', 'prensa', 'comunitario', 'osm', 'demo');--> statement-breakpoint
CREATE TYPE "public"."territorial_level" AS ENUM('departamento', 'provincia', 'distrito');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('oficial', 'verificado', 'pendiente', 'no_verificado');--> statement-breakpoint
CREATE TABLE "city_block_hazards" (
	"block_id" varchar(20) NOT NULL,
	"hazard_type_code" varchar(32) NOT NULL,
	"level" smallint NOT NULL,
	"details" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "city_block_hazards_block_id_hazard_type_code_pk" PRIMARY KEY("block_id","hazard_type_code"),
	CONSTRAINT "city_block_hazards_level_range" CHECK ("city_block_hazards"."level" BETWEEN -1 AND 4)
);
--> statement-breakpoint
CREATE TABLE "city_blocks" (
	"id" varchar(20) PRIMARY KEY NOT NULL,
	"ubigeo" varchar(6) NOT NULL,
	"zone" varchar(8) NOT NULL,
	"block" varchar(8) NOT NULL,
	"populated_place_code" varchar(8),
	"geom" geometry(MultiPolygon, 4326) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"institution" text NOT NULL,
	"name" text NOT NULL,
	"url" text,
	"license" text,
	"type" "source_type" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "datasets" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" integer NOT NULL,
	"title" text NOT NULL,
	"hazard_type_code" varchar(32),
	"scale" text,
	"source_date" text,
	"retrieved_at" timestamp with time zone,
	"method" text,
	"coverage" geometry(MultiPolygon, 4326),
	"verification_status" "verification_status" DEFAULT 'pendiente' NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "evacuation_arrows" (
	"id" serial PRIMARY KEY NOT NULL,
	"dataset_id" integer NOT NULL,
	"hazard_type_code" varchar(32) NOT NULL,
	"bearing_deg" smallint NOT NULL,
	"geom" geometry(Point, 4326) NOT NULL,
	"confidence" text,
	"verification_status" "verification_status" DEFAULT 'pendiente' NOT NULL,
	CONSTRAINT "evacuation_arrows_bearing_range" CHECK ("evacuation_arrows"."bearing_deg" BETWEEN 0 AND 359)
);
--> statement-breakpoint
CREATE TABLE "hazard_features" (
	"id" serial PRIMARY KEY NOT NULL,
	"dataset_id" integer NOT NULL,
	"hazard_type_code" varchar(32) NOT NULL,
	"category" "feature_category" NOT NULL,
	"level" smallint,
	"level_label" text,
	"geom" geometry(Geometry, 4326) NOT NULL,
	"location_confidence" "location_confidence" DEFAULT 'alta' NOT NULL,
	"approx_radius_m" integer,
	"event_date" text,
	"ubigeo" varchar(6),
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "hazard_features_level_range" CHECK ("hazard_features"."level" IS NULL OR "hazard_features"."level" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE TABLE "hazard_types" (
	"code" varchar(32) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "safe_zone_hazards" (
	"safe_zone_id" integer NOT NULL,
	"hazard_type_code" varchar(32) NOT NULL,
	CONSTRAINT "safe_zone_hazards_safe_zone_id_hazard_type_code_pk" PRIMARY KEY("safe_zone_id","hazard_type_code")
);
--> statement-breakpoint
CREATE TABLE "safe_zones" (
	"id" serial PRIMARY KEY NOT NULL,
	"dataset_id" integer NOT NULL,
	"type" "safe_zone_type" NOT NULL,
	"name" text,
	"reference" text,
	"geom" geometry(Point, 4326) NOT NULL,
	"precision_m" integer,
	"verification_status" "verification_status" DEFAULT 'pendiente' NOT NULL,
	"ubigeo" varchar(6),
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "territorial_units" (
	"ubigeo" varchar(6) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"level" "territorial_level" NOT NULL,
	"parent_ubigeo" varchar(6),
	"geom" geometry(MultiPolygon, 4326),
	"geom_simplified" geometry(MultiPolygon, 4326)
);
--> statement-breakpoint
ALTER TABLE "city_block_hazards" ADD CONSTRAINT "city_block_hazards_block_id_city_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."city_blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "city_block_hazards" ADD CONSTRAINT "city_block_hazards_hazard_type_code_hazard_types_code_fk" FOREIGN KEY ("hazard_type_code") REFERENCES "public"."hazard_types"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "city_blocks" ADD CONSTRAINT "city_blocks_ubigeo_territorial_units_ubigeo_fk" FOREIGN KEY ("ubigeo") REFERENCES "public"."territorial_units"("ubigeo") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "datasets" ADD CONSTRAINT "datasets_source_id_data_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."data_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "datasets" ADD CONSTRAINT "datasets_hazard_type_code_hazard_types_code_fk" FOREIGN KEY ("hazard_type_code") REFERENCES "public"."hazard_types"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evacuation_arrows" ADD CONSTRAINT "evacuation_arrows_dataset_id_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."datasets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evacuation_arrows" ADD CONSTRAINT "evacuation_arrows_hazard_type_code_hazard_types_code_fk" FOREIGN KEY ("hazard_type_code") REFERENCES "public"."hazard_types"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hazard_features" ADD CONSTRAINT "hazard_features_dataset_id_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."datasets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hazard_features" ADD CONSTRAINT "hazard_features_hazard_type_code_hazard_types_code_fk" FOREIGN KEY ("hazard_type_code") REFERENCES "public"."hazard_types"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hazard_features" ADD CONSTRAINT "hazard_features_ubigeo_territorial_units_ubigeo_fk" FOREIGN KEY ("ubigeo") REFERENCES "public"."territorial_units"("ubigeo") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safe_zone_hazards" ADD CONSTRAINT "safe_zone_hazards_safe_zone_id_safe_zones_id_fk" FOREIGN KEY ("safe_zone_id") REFERENCES "public"."safe_zones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safe_zone_hazards" ADD CONSTRAINT "safe_zone_hazards_hazard_type_code_hazard_types_code_fk" FOREIGN KEY ("hazard_type_code") REFERENCES "public"."hazard_types"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safe_zones" ADD CONSTRAINT "safe_zones_dataset_id_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."datasets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safe_zones" ADD CONSTRAINT "safe_zones_ubigeo_territorial_units_ubigeo_fk" FOREIGN KEY ("ubigeo") REFERENCES "public"."territorial_units"("ubigeo") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "city_blocks_geom_gist" ON "city_blocks" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "city_blocks_ubigeo_idx" ON "city_blocks" USING btree ("ubigeo");--> statement-breakpoint
CREATE INDEX "datasets_coverage_gist" ON "datasets" USING gist ("coverage");--> statement-breakpoint
CREATE INDEX "evacuation_arrows_geom_gist" ON "evacuation_arrows" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "hazard_features_geom_gist" ON "hazard_features" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "hazard_features_type_idx" ON "hazard_features" USING btree ("hazard_type_code","category");--> statement-breakpoint
CREATE INDEX "safe_zones_geom_gist" ON "safe_zones" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "territorial_units_geom_gist" ON "territorial_units" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "territorial_units_parent_idx" ON "territorial_units" USING btree ("parent_ubigeo");