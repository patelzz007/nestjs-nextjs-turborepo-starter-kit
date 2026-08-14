-- Backfill zero epoch timestamps (from @default(0) era) with the current epoch.
-- Each column is updated independently so a shared zero sentinel can't leak.
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE data_type = 'bigint'
          AND table_schema = 'public'
          AND (column_name ILIKE '%at%' OR column_name ILIKE '%until%' OR column_name ILIKE '%expires%' OR column_name ILIKE '%used%' OR column_name ILIKE '%verified%' OR column_name ILIKE '%locked%')
          AND column_name NOT IN ('io_generation')
        ORDER BY table_name, column_name
    LOOP
        EXECUTE format('UPDATE %I SET %I = (EXTRACT(EPOCH FROM now()) * 1000)::bigint WHERE %I = 0', r.table_name, r.column_name, r.column_name);
    END LOOP;
END
$$;
