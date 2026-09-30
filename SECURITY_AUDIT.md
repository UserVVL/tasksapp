# Отчёт по аудиту безопасности TextureTasks

Дата: 30.09.2026 · Область: backend (FastAPI), frontend (React), nginx/TLS, systemd, БД PostgreSQL
Метод: статический анализ всего кода (OWASP API Top 10, BOLA/привилегии, валидация загрузок, auth/сессии)
Статус: статический аудит завершён; **все исправления внесены в локальный код**, смок-тест 28/28 пройден (uvicorn + копия dev-БД). **Живые проверки на сервере не выполнены — сервер недоступен** (порт 22/80/443 таймаут): деплой фиксов и проверки ниже — после включения сервера.

---

## Сводка и статусы исправлений

| # | Находка | Статус |
|---|---|---|
| H1 | PATCH: маляр правит любые задачи/рейтинг | ✅ **Исправлено** — PATCH только director/manager (`tasks.py:142`), маляру остается старт/сдать/отмена; UI и так gated by `isManager` |
| H2 | Обход rate-limit → брутфорс | ✅ **Исправлено** — ключ `_client_ip()`: X-Real-IP → последний XFF-hop → client; nginx шлёт `X-Forwarded-For $remote_addr` (несфальсифицируемый хоп); `_prune()` cap 5000; успех сбрасывает счётчик; тест: 11-я попытка → 429, чужой IP жив |
| H3 | Менеджер создаёт director | ✅ **Исправлено** — `register`: не-director не может создать director (403) |
| H4 | Расширение из имени файла → stored XSS | ✅ **Исправлено** — ext только из проверенного MIME (MIME_TO_EXT), `evil.php`→`.png` подтверждено; Content-Type форсируется; отдача по имени файла из БД (path traversal закрыт) |
| M1 | JWT 30 дней | ✅ **720 мин (12 ч)** |
| M2 | JWT в access-логах nginx | ✅ **`log_format masked`** — без query string, `?token=` не пишется |
| M3 | Нет security-заголовков на статике | ✅ **HSTS, CSP, nosniff, X-Frame-Options: DENY, Referrer-Policy, Permissions-Policy** — на server-блоке и во всех 4 `add_header`-локациях |
| M4 | BOLA: действия по чужим задачам | ✅ **`_ensure_assignee()`** в start/complete/cancel/upload (upload — всегда для не-менеджеров); *просмотр* картинок оставлен открытым всем залогиненным — согласовано с M5/M6 |
| M5 | Недельные списки видны всем | ⏸ **Принято как дизайн** (общий план) — подтвердить с пользователем |
| M6 | Архив виден всем ролям | ⏸ **Принято как дизайн** — подтвердить с пользователем |
| M7 | requirements.txt неполный | ✅ **+`python-magic==0.4.27`, `python-multipart==0.0.32`** |
| M8 | Менеджер меняет менеджеру | ✅ **Запрещено** (кроме самого себя); director поверх всех ✓ |
| L1 | SECRET_KEY по умолчанию | ✅ **Локально:** эфемерный случайный ключ при старте + CRITICAL-лог, если дефолтный/пустой. ⚠️ **серверный `.env` — живая проверка** |
| L2 | CORS: http + dev-порты | ✅ **Сужено** до `https://texturetasks.ru` (+localhost dev) |
| L3 | `int(content-length)` → 500 | ✅ try/except ValueError |
| L4 | Рост словаря rate-limit | ✅ **В составе H2** — `_prune()`, `MAX_TRACKED_IPS=5000` |
| L5 | `assignee_ids` в PATCH → 500 | ✅ Поле корректно обрабатывается; ветка доступна только менеджерам |
| L6 | `mark_read` несуществующего → 500 | ✅ **404** |
| L7 | username без валидации | ✅ `min_length=3, max_length=50, pattern=^[a-zA-Z0-9_.-]+$`; пароль ≤128; full_name ≤100 |
| L8 | Пароль director в журнале | ✅ **Печатается только в stdout сессии** (print, не logger) |
| L9 | Права на бэкапы | ✅ chmod: dirs 700, файлы 600 (`backup_service.py`) |
| L10 | Нет персистентного security-лога | ⏸ **Не исправлено** (низкий; опциональное улучшение) |

**Итого:** 19 исправлено · 2 принято как дизайн (M5/M6, подтвердить) · 1 отложен (L10) · живые проверки ждут сервера.

**Верификация:** смок-тест на локальном uvicorn (копия dev-БД, пароли тестовых юзеров) — **28/28 PASS**: H1/H2/H3/H4, M1/M4/M8, L2/L3/L6/L7, CORS, security-заголовки, BOLA-start, traversal, TTL=12h. Фронтенд не менялся (UI уже гейтит редактирование по `isManager`) — пересборка не нужна.

---

## Высокие

### H1. Массовое присвоение полей: маляр может менять статус/оценку любой задачи
- **Где:** `backend/app/schemas/task.py:44-61` (`TaskUpdate` включает `status`, `rating`, `review_comment`), `backend/app/routers/tasks.py:127-167`
- **Суть:** `update_task` разрешает роль painter (строка 136), белого списка полей нет, проверки «задача назначена мне» нет. Маляр может через `PATCH /api/tasks/{id}`:
  - менять `status` любой задачи (в архив, обратно, отмена);
  - менять `rating` уже принятых задач → **искажает месячный отчёт** (`users.py:40-57` суммирует `t.rating`);
  - править title/description/room/deadline чужих задач;
  - история изменений пишется с его id.
- **Почему опасно:** обход workflow (pool→in_progress→review→done), накрутка/порча рейтинга, вандализм.
- **Исправление:** разделить схемы: маляру — только `title/description/room` и только по своим задачам (лучше — убрать PATCH для маляров, оставить start/complete/cancel); `status/rating/review_comment` — только для director/manager.

### H2. Обход rate-limit на логин → бесконечный брутфорс
- **Где:** `backend/app/routers/auth.py:63-64` (ключ = весь заголовок `X-Forwarded-For`), `deploy/texturetasks.nginx:34` (`$proxy_add_x_forwarded_for`)
- **Суть:** nginx добавляет реальный IP **после** клиентского значения. Клиент шлёт `X-Forwarded-For: <случайный>` → ключ лимитера меняется каждый запрос → лимит 10 попыток/5 мин не применяется. Побочно: словарь `_login_attempts` растёт неограниченно (память).
- **Почему опасно:** бесконечный перебор паролей director-аккаунта без блокировок.
- **Исправление:** брать ключ из `X-Real-IP` (ставится nginx, подделать нельзя) или последний IP в цепочке XFF; добавить глобальный лимит/блокировку аккаунта; чистить словарь.

### H3. Менеджер может создать аккаунт director (эскалация привилегий)
- **Где:** `backend/app/routers/auth.py:37-58` (`register` не ограничивает `data.role` для менеджера)
- **Суть:** в `update_user` запрещён апгрейд до director (`users.py:118-119`), но через `/api/auth/register` менеджер создаёт пользователя с `role: director` → полный контроль (удаление недельных списков, редактирование любых пользователей).
- **Исправление:** в `register`: не-director может создавать только painter/admin (как минимум — не director).

### H4. Загрузка: расширение файла не валидируется → stored XSS через полиглот
- **Где:** `backend/app/routers/tasks.py:364-365` (ext берётся из имени файла клиента), `:423` (`FileResponse` определяет Content-Type по расширению)
- **Суть:** содержимое проверяется по magic bytes (хорошо), но расширение любое (`.html`, `.svg`). GIF/HTML-полиглот, сохранённый как `x.html`, отдаётся как `text/html` на домене texturetasks.ru → JS выполняется в сессии жертвы (нужен залогиненный пользователь, т.к. картинка требует token) → **кража JWT из localStorage** (`client.ts:6`).
- **Исправление:** выводить расширение из проверенного MIME (jpg/png/gif/webp/heic/heif), форсировать `Content-Type` на сервере.

---

## Средние

### M1. JWT живёт 30 дней без отзыва
`config.py:6` — `ACCESS_TOKEN_EXPIRE_MINUTES = 43200`. Смена пароля не отзывает выданные токены (деактивация — отзывает, `get_current_user` проверяет `is_active` ✓). Украденный токен = доступ месяц. **Исправление:** 8–12 часов (или refresh-токены).

### M2. JWT попадает в access-логи nginx
`frontend/src/api/tasks.ts:103` добавляет `?token=` в URL картинки; nginx пишет полный URI в `/var/log/nginx/texturetasks-access.log` →30-дневный JWT в логах. **Исправление:** короткоживущие токены для картинок, либо cookie, либо маскировать query в log_format.

### M3. У статики нет security-заголовков; нет HSTS; нет CSP
Заголовки из `main.py:92-104` действуют только на `/api/*` (проксируется бэкендом). HTML/PWA отдаёт nginx без X-Frame-Options, X-Content-Type-Options, HSTS, CSP. При токене в localStorage отсутствие CSP повышает риск XSS. **Исправление:** `add_header` в nginx-блоке443 + `Strict-Transport-Security: max-age=31536000; includeSubDomains` + базовый CSP.

### M4. BOLA: любые действия по чужим задачам
- `start_task/complete_task/cancel_task` (`tasks.py:170-247`): проверяется только роль, **не** что задача назначена этому маляру → можно гадать id и трогать чужие задачи.
- `upload_task_image` (`tasks.py:341`): ограничение «только исполнитель» действует **лишь при status=in_progress**; для pool/review/done любой пользователь может загружать файлы в чужие задачи.
- `get_task_images`/`serve_task_image`: любой залогиненный видит картинки любой задачи (нет проверки assignee).
- **Исправление:** везде проверять `current_user.id in [a.id for a in task.assignees]` для не-менеджеров.

### M5. Недельные списки полностью видны всем
`weekly_lists.py:19-32,60-75`: любой пользователь видит все задачи недель (чужие назначения, описания). Возможно, это осознанный «общий план» — подтвердить. Если нет — фильтровать по assignee для маляров.

### M6. Архив виден всем ролям
`tasks.py:298-308`: `get_archive` без фильтра по роли/исполнителю — маляр видит все архивные задачи (оценки, номера комнат, исполнителей). Ранее это могло быть решением пользователя — подтвердить намерение.

### M7. `requirements.txt` неполный — свежий деплой сломается
В requirements **нет** `python-magic` (импорт в `tasks.py:7`) и `python-multipart` (нужен для `UploadFile`) — они есть в venv только потому, что ставились вручную. **Исправление:** дополнить requirements.

### M8. Менеджер может менять пароли другим менеджерам
`users.py:90-125`: manager не может редактировать director, но может менять пароль/деактивировать другого manager. Малое вероятность (мало менеджеров), но нарушает иерархию — подтвердить как дизайн.

---

## Низкие

| # | Находка | Где |
|---|---|---|
| L1 | **SECRET_KEY по умолчанию `change-me-in-production`** — если на сервере нет своего ключа, любой может подделать JWT director. Локальный `.env` — ключ64 симв. ✓, **серверный не проверен (сервер недоступен)**. Срочно проверить! | `config.py:6` |
| L2 | CORS разрешает `http://texturetasks.ru` (без TLS) и устаревшие dev-порты — сузить до `https://texturetasks.ru` | `main.py:79` |
| L3 | `int(content-length)` без try — кривой заголовок → 500 | `main.py:96` |
| L4 | Словарь rate-limit растёт неограниченно (связано с H2) → DoS памяти | `auth.py:25-34` |
| L5 | Маляр шлёт `assignee_ids` в PATCH → `getattr` → AttributeError → 500 | `tasks.py:150` |
| L6 | `mark_read` для несуществующего id возвращает None → ошибка валидации 500 вместо 404 | `notifications.py:45-48` |
| L7 | `username` без валидации длины (>50 → ошибка БД → 500); пароль min8 без сложности | `schemas/user.py:20-24` |
| L8 | Пароль director печатается в журнал при сиде (`journalctl` читаем из группы adm) | `seed.py:40-47` |
| L9 | Бэкапы (pg_dump с bcrypt-хешами + аплады) лежат в `/opt/texturetasks/backups`, пароль БД захардкожен в коде — не в веб-доступе ✓, но проверить права 700 | `backup_service.py:46` |
| L10 | Нет персистентного security-лога попыток входа (только journal) | `auth.py:70` |

**Критично (ожидает живой проверки):** L1 — см. выше.

---

## Что сделано хорошо

- bcrypt-хеширование паролей, min длина пароля8
- Валидация MIME по magic bytes при загрузке (не только расширение)
- Отдача картинок только по токену (ранее исправлено)
- Уведомления строго привязаны к владельцу
- uvicorn слушает только `127.0.0.1:8000` (`deploy/texturetasks.service:10`)
- SQL-инъекций нет (ORM + статические SQL)
- XSS-стоков во фронтенде нет (React, нет dangerouslySetInnerHTML/eval)
- TLS1.2/1.3, редирект 80→443, `X-Frame-Options: DENY`, nosniff, Referrer-Policy на API
- Регистрация только для director/manager
- `is_active` проверяется на каждом запросе (деактивация работает)
- `/docs`, `/openapi.json` не проксируются nginx (падают в SPA-fallback) — подтвердить живой проверкой

---

## Осталось (после включения сервера)

**1. Деплой фиксов:**
```bash
# frontend не менялся — сборка не нужна
rsync -av --exclude 'venv' --exclude 'dev.db' --exclude '__pycache__' --exclude '.env' \
  --exclude 'uploads' --exclude 'backups' backend/ root@<ВАШ_СЕРВЕР>:/opt/texturetasks/backend/
# requirements: pip install -r requirements.txt на сервере (уже стоят, проверить)
ssh root@<ВАШ_СЕРВЕР> "cd /opt/texturetasks/backend && ./venv/bin/pip install -r requirements.txt && systemctl restart texturetasks"
# nginx: новый конфиг (log_format masked, заголовки, XFF)
scp deploy/texturetasks.nginx root@<ВАШ_СЕРВЕР>:/etc/nginx/sites-available/texturetasks
ssh root@<ВАШ_СЕРВЕР> "nginx -t && systemctl reload nginx"
```

**2. Живые проверки (было заблокировано):**
1. **Секретный ключ (критично):** `grep SECRET_KEY /opt/texturetasks/backend/.env` ≠ `change-me-in-production`; при его отсутствии лог покажет `CRITICAL ... ephemeral SECRET_KEY generated` → лучше положить свой ключ в `.env`
2. Заголовки: `curl -sI https://texturetasks.ru/` → HSTS/CSP/nosniff/XFO; `curl -sI https://texturetasks.ru/api/auth/me` →同样
3. CORS-проба с `Origin: http://texturetasks.ru` → без ACAO; `https://...` → с ACAO
4. Rate-limit с реального IP (не подделывать XFF — фикс H2)
5. `/docs`, `/openapi.json` извне; `ss -tlnp | grep 8000` — только 127.0.0.1
6. Права: `ls -la /opt/texturetasks/{backups,backend/.env}` — 700/600
7. **Сменить тестовые пароли** (director). Пароль БД задаётся через `PGPASSWORD` в `.env` (ранее был захардкожен в `backup_service.py` — исправлено, см. Task плана публикации)
8. Доступность сайта, логин, загрузка фото (MIME→ext), правки задач

**3. Решения по design-находкам:** M5/M6 (общий план/архив видны всем) — если ок, оставить; L10 (security-лог) — по желанию.
