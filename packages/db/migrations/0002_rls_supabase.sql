-- RLS-адаптер для Supabase (TASK 16.2). Переключает источник «текущего пользователя»
-- с локальной эмуляции current_setting('app.current_user_id') на нативный auth.uid().
-- Все политики вызывают app_current_user_id() (через app_is_org_member), поэтому
-- достаточно переопределить ОДНУ функцию — политики автоматически подхватят auth.uid().
--
-- Совместимо с обоими окружениями:
--   • Supabase  → есть auth.uid()         → используется он;
--   • локально  → auth.uid() отсутствует  → фолбэк на current_setting (ЭТАП 3.4).
CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS uuid
  LANGUAGE plpgsql STABLE AS $$
DECLARE
  uid uuid;
BEGIN
  -- На Supabase auth.uid() существует; локально — нет (ловим исключение).
  BEGIN
    EXECUTE 'SELECT auth.uid()' INTO uid;
  EXCEPTION
    WHEN undefined_function OR invalid_schema_name OR undefined_table THEN
      uid := NULL;
  END;
  IF uid IS NOT NULL THEN
    RETURN uid;
  END IF;
  RETURN NULLIF(current_setting('app.current_user_id', true), '')::uuid;
END $$;
