-- RoadSafe NZ — initial schema.
--
-- One row per reported crash, loaded from the pipeline's feature CSV.
-- Column names are the CAS names in snake_case; see DATA_DICTIONARY.md for
-- meanings. Applied by data-pipeline/src/load_database.py, which records
-- each migration in schema_migrations.

CREATE EXTENSION IF NOT EXISTS postgis;

-- Which download a set of rows came from. CAS is updated in place and its
-- OBJECTID is renumbered between exports, so every crash row belongs to
-- exactly one snapshot and the snapshot is identified by content, not by
-- file name.
CREATE TABLE snapshots (
    snapshot_id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sha256               char(64)    NOT NULL,
    content_fingerprint  char(16)    NOT NULL UNIQUE,
    source_last_modified text,
    retrieved_at         timestamptz NOT NULL,
    row_count            integer     NOT NULL CHECK (row_count > 0),
    loaded_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE crashes (
    -- Surrogate key. OBJECTID is kept only as source_object_id: it is unique
    -- within one export and meaningless across exports.
    crash_id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    snapshot_id          integer NOT NULL REFERENCES snapshots ON DELETE CASCADE,
    source_object_id     integer NOT NULL,

    -- Location. geom is NULL when location_valid is false (placeholder or
    -- out-of-country coordinates); x/y_nztm keep NZTA's published values.
    x_nztm               double precision NOT NULL,
    y_nztm               double precision NOT NULL,
    longitude            double precision,
    latitude             double precision,
    location_valid       boolean NOT NULL,
    geom                 geometry(Point, 4326),
    region               text,
    tla_id               integer,
    tla_name             text,
    area_unit_id         integer,
    meshblock_id         integer,
    crash_location1      text,
    crash_location2      text,
    crash_sh_description text,
    urban                text,

    -- Time. CAS publishes no finer resolution than the year.
    crash_year           smallint NOT NULL CHECK (crash_year BETWEEN 1990 AND 2100),
    crash_financial_year text,
    holiday              text,

    -- Outcome. The casualty counts define the severity, so they must never
    -- be model inputs (see mlService / DECISIONS #6).
    crash_severity       text NOT NULL CHECK (crash_severity IN
                             ('Fatal Crash', 'Serious Crash', 'Minor Crash', 'Non-Injury Crash')),
    is_severe            boolean NOT NULL,
    fatal_count          smallint,
    serious_injury_count smallint,
    minor_injury_count   smallint,

    -- Road and environment.
    crash_direction_description text,
    direction_role_description  text,
    flat_hill            text,
    light                text,
    number_of_lanes      smallint,
    road_character       text,
    road_lane            text,
    road_surface         text,
    speed_limit          smallint,
    street_light         text,
    temporary_speed_limit smallint,
    traffic_control      text,
    weather_a            text,
    weather_b            text,

    -- Vehicles and people involved (counts).
    bicycle              smallint NOT NULL,
    bus                  smallint NOT NULL,
    car_station_wagon    smallint NOT NULL,
    moped                smallint NOT NULL,
    motorcycle           smallint NOT NULL,
    other_vehicle_type   smallint NOT NULL,
    pedestrian           smallint NOT NULL,
    school_bus           smallint NOT NULL,
    suv                  smallint NOT NULL,
    taxi                 smallint NOT NULL,
    truck                smallint NOT NULL,
    unknown_vehicle_type smallint NOT NULL,
    van_or_utility       smallint NOT NULL,

    -- Objects struck (counts). Blank in the raw export means none struck;
    -- object_involved records whether the block was filled at all.
    object_involved      boolean  NOT NULL,
    bridge               smallint NOT NULL,
    cliff_bank           smallint NOT NULL,
    debris               smallint NOT NULL,
    ditch                smallint NOT NULL,
    fence                smallint NOT NULL,
    guard_rail           smallint NOT NULL,
    house_or_building    smallint NOT NULL,
    kerb                 smallint NOT NULL,
    object_thrown_or_dropped smallint NOT NULL,
    other_object         smallint NOT NULL,
    over_bank            smallint NOT NULL,
    parked_vehicle       smallint NOT NULL,
    phone_box_etc        smallint NOT NULL,
    post_or_pole         smallint NOT NULL,
    roadworks            smallint NOT NULL,
    slip_or_flood        smallint NOT NULL,
    stray_animal         smallint NOT NULL,
    traffic_island       smallint NOT NULL,
    traffic_sign         smallint NOT NULL,
    train                smallint NOT NULL,
    tree                 smallint NOT NULL,
    vehicle              smallint NOT NULL,
    water_river          smallint NOT NULL,

    -- Engineered features (feature_engineering.py).
    total_vehicles_involved      smallint NOT NULL,
    adverse_weather              boolean  NOT NULL,
    is_unsealed_road             boolean  NOT NULL,
    is_hill_road                 boolean  NOT NULL,
    is_low_light                 boolean  NOT NULL,
    is_uncontrolled_intersection boolean  NOT NULL,
    road_hazard_score            smallint NOT NULL CHECK (road_hazard_score BETWEEN 0 AND 5),
    speed_limit_binned           text,

    UNIQUE (snapshot_id, source_object_id),
    CHECK (is_severe = (crash_severity IN ('Fatal Crash', 'Serious Crash'))),
    CHECK ((geom IS NULL) = (NOT location_valid))
);

-- The filters every page applies, and the spatial index for map and
-- proximity queries.
CREATE INDEX crashes_snapshot_year_idx   ON crashes (snapshot_id, crash_year);
CREATE INDEX crashes_region_idx          ON crashes (region);
CREATE INDEX crashes_tla_idx             ON crashes (tla_name);
CREATE INDEX crashes_severity_idx        ON crashes (crash_severity);
CREATE INDEX crashes_geom_idx            ON crashes USING gist (geom);

-- What the API reads: only the most recently loaded snapshot.
CREATE VIEW current_crashes AS
SELECT c.*
FROM crashes c
WHERE c.snapshot_id = (SELECT max(snapshot_id) FROM snapshots);
