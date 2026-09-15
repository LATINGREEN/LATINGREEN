-- Reversion de 0010. Al desactivar RLS las politicas no desaparecen, asi que
-- se eliminan explicitamente.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
      FROM pg_policies
     WHERE schemaname IN ('ai', 'org', 'doc')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;

  FOR r IN
    SELECT n.nspname AS schemaname, c.relname AS tablename
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname IN ('ai', 'org', 'doc')
       AND c.relkind = 'r'
       AND c.relrowsecurity
  LOOP
    EXECUTE format('ALTER TABLE %I.%I NO FORCE ROW LEVEL SECURITY', r.schemaname, r.tablename);
    EXECUTE format('ALTER TABLE %I.%I DISABLE ROW LEVEL SECURITY', r.schemaname, r.tablename);
  END LOOP;
END
$$;

DROP FUNCTION IF EXISTS seg.unidad_en_ambito(bigint);
