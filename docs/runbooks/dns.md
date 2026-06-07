# Runbook — Домены и DNS (ЭТАП 17.2)

Домены подключаются к Vercel, DNS — на Cloudflare (proxied для DDoS-защиты).

## Домены
| Домен                 | Назначение                  |
|-----------------------|-----------------------------|
| `avastudio.com`       | Лендинг (marketing)         |
| `www.avastudio.com`   | Редирект на apex            |
| `app.avastudio.com`   | Приложение (apps/web)       |
| `api.avastudio.com`   | (опц.) выделенный API-хост   |

## Шаги
1. Vercel → Project → Settings → Domains → добавить домены выше.
2. Cloudflare → DNS:
   - `app` → CNAME `cname.vercel-dns.com`, **Proxied** (оранжевое облако).
   - apex `@` → CNAME flattening на `cname.vercel-dns.com` (или A на Vercel anycast), Proxied.
   - `www` → CNAME `@` (редирект через Vercel/Cloudflare rule).
3. SSL: Cloudflare SSL/TLS mode = **Full (strict)**. Дождаться выпуска сертификатов.
4. Проверить: все домены резолвятся в Vercel, статус «Valid Configuration», HTTPS зелёный.

## Важно
- Proxied (оранжевое облако) даёт DDoS-защиту и WAF (TASK 17.4), но требует
  SSL mode Full (strict), иначе цикл редиректов.
- Apex через CNAME flattening — стандартный приём Cloudflare.
