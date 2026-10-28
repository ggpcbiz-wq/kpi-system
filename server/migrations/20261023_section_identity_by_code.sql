DO $$
DECLARE
  constraint_name text;
  index_schema text;
  index_name text;
BEGIN
  FOR constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'sections'::regclass
      AND c.contype = 'u'
      AND (
        SELECT array_agg(a.attname::text ORDER BY key_column.ordinality)
        FROM unnest(c.conkey) WITH ORDINALITY AS key_column(attnum, ordinality)
        JOIN pg_attribute a
          ON a.attrelid = c.conrelid
         AND a.attnum = key_column.attnum
      ) = ARRAY['department_id', 'name']::text[]
  LOOP
    EXECUTE format('ALTER TABLE sections DROP CONSTRAINT %I', constraint_name);
  END LOOP;

  FOR index_schema, index_name IN
    SELECT schema_info.nspname, index_info.relname
    FROM pg_index i
    JOIN pg_class index_info ON index_info.oid = i.indexrelid
    JOIN pg_namespace schema_info ON schema_info.oid = index_info.relnamespace
    WHERE i.indrelid = 'sections'::regclass
      AND i.indisunique
      AND NOT i.indisprimary
      AND NOT EXISTS (
        SELECT 1 FROM pg_constraint c WHERE c.conindid = i.indexrelid
      )
      AND (
        SELECT array_agg(a.attname::text ORDER BY key_column.ordinality)
        FROM unnest(i.indkey) WITH ORDINALITY AS key_column(attnum, ordinality)
        JOIN pg_attribute a
          ON a.attrelid = i.indrelid
         AND a.attnum = key_column.attnum
        WHERE key_column.ordinality <= i.indnkeyatts
      ) = ARRAY['department_id', 'name']::text[]
  LOOP
    EXECUTE format('DROP INDEX %I.%I', index_schema, index_name);
  END LOOP;
END $$;

ALTER TABLE sections
  ADD CONSTRAINT sections_department_id_code_key UNIQUE (department_id, code);
