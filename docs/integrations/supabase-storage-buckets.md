# Supabase Storage — бакеты и политики (TASK 16.3)

Три бакета. Приложение ходит в Storage через `SupabaseStorageAdapter` (тот же
`StorageAdapter`-порт, что и локальный — бизнес-код не меняется).

## Бакеты
| Бакет             | Доступ   | Назначение                                  |
|-------------------|----------|---------------------------------------------|
| `user-uploads`    | private  | Исходники, загруженные пользователем         |
| `generated-media` | private  | Результаты рендера/AI-генерации              |
| `public-assets`   | public   | Публичные ассеты (обложки, аватары и т.п.)   |

## Конвенция путей
Объекты складываются под префиксом организации: `<org_id>/<asset_id>/<filename>`.
Это позволяет RLS-политикам проверять принадлежность по первому сегменту пути.

## RLS-политики (SQL, выполнить в Supabase SQL editor)
```sql
-- Приватные бакеты: доступ только членам организации (первый сегмент пути = org_id).
create policy "org members read private"
on storage.objects for select to authenticated
using (
  bucket_id in ('user-uploads','generated-media')
  and app_is_org_member((split_part(name,'/',1))::uuid)
);

create policy "org members write private"
on storage.objects for insert to authenticated
with check (
  bucket_id in ('user-uploads','generated-media')
  and app_is_org_member((split_part(name,'/',1))::uuid)
);

create policy "org members delete private"
on storage.objects for delete to authenticated
using (
  bucket_id in ('user-uploads','generated-media')
  and app_is_org_member((split_part(name,'/',1))::uuid)
);

-- Публичный бакет: чтение всем, запись — только service role (через бэкенд).
create policy "public read"
on storage.objects for select to public
using (bucket_id = 'public-assets');
```
(`app_is_org_member` — та же helper-функция RLS из ЭТАП 3.4 / миграции `0002_rls_supabase`.)

## Подключение в коде
```ts
import { createClient } from "@supabase/supabase-js";
import { SupabaseStorageAdapter } from "@/server/storage/supabase-adapter";

const supa = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const adapter = new SupabaseStorageAdapter({
  bucket: supa.storage.from("generated-media"),
  bucketName: "generated-media",
});
```
`SERVICE_ROLE_KEY` — только сервер/worker, НИКОГДА не на фронт.
