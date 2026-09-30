# План: публикация TextureTasks на GitHub как портфолио-репозиторий

Дата: 30.09.2026 · Статус: исполнение завершено (Tasks 0–9)

Цель: выложить существующий проект (`FastAPI + React`) в публичный репозиторий
`UserVVL/tasksapp` — без секретов и персональных данных, с русскоязычным README,
санитизированным аудитом безопасности и скриншотами.

## Зафиксированные решения

- README — на русском языке.
- `SECURITY_AUDIT.md` публикуется в санитизированном виде.
- В README упоминается `https://texturetasks.ru` без демо-аккаунтов
  (позже отменено: демо-сервер выключен, ссылка в README убрана, чтобы не вести
  на несуществующую страницу; домен остаётся только в конфигах `deploy/`).
- Репозиторий: `git@github.com:UserVVL/tasksapp.git` / `https://github.com/UserVVL/tasksapp.git`.
- Git identity: `UserVVL <UserVVL@users.noreply.github.com>` (настроена глобально).
- Лицензия НЕ добавляется (раздел «Лицензия» в README отсутствует).
- Удалённое репо: публичное, ветка `main`, пустое → push обычный, без rebase.

## Задачи

- [x] **Task 0** — проверить SSH (`ssh -T git@github.com`) и настроить глобальную git identity.
- [x] **Task 1** — `git init -b main`; расширить `.gitignore`
  (`backend/.env`, `backend/uploads/`, `backend/backups/`, `*.tar.gz`, `/dev.db`,
  `PROJECT_NOTES.md`, `/image*.png`); проверить `git check-ignore` —
  13/13 чувствительных путей игнорируются, легитимный код — трекается.
- [x] **Task 2** — убрать секреты из кода:
  - `backend/app/config.py` — поле `PGPASSWORD: str = ""` (пароль БД больше не литерал);
  - `backend/app/services/backup_service.py` — `settings.PGPASSWORD`,
    PG-параметры через `os.environ.get`;
  - verify: 0 вхождений старого пароля в `*.py`, `__pycache__` очищен.
- [x] **Task 3** — создать `backend/.env.example` (DATABASE_URL, SECRET_KEY с генерацией,
  PGPASSWORD, PG-параметры, опции приложения).
- [x] **Task 4** — санитизировать `SECURITY_AUDIT.md`:
  реальный IP сервера → `root@<ВАШ_СЕРВЕР>`, убраны тестовые пароли;
  grep по IP/паролям/токенам → чисто.
- [x] **Task 5** — нейтральные демо-данные в локальной `dev.db`
  (имена сотрудников → Иван/Пётр/Мария/Алексей/Дмитрий/Никита).
- [x] **Task 6** — скриншоты 1440×900 в `docs/screenshots/`
  (login, dashboard, список задач, сотрудники, отчёт);
  созданы демо-задачи текущей недели, чтобы дашборд и список не были пустыми.
- [x] **Task 7** — корневой `README.md` на русском: 소개 → сайт → скриншоты →
  возможности → стек → архитектура → безопасность → быстрый старт → деплой →
  структура репозитория (без раздела «Лицензия»).
- [x] **Task 8** — остановить dev-серверы; `git add -A`; аудит индекса:
  - `git ls-files | grep -E '\.env$|\.db$|^backend/uploads/|^backend/backups/|\.tar\.gz$|PROJECT_NOTES'` → пусто;
  - `git grep --cached -InE '<IP>|<тестовые пароли>|<токены>'` → пусто;
  - `git commit -m "TextureTasks: full-stack task management app (FastAPI + React)"`.
- [x] **Task 9** — `git remote add origin git@github.com:UserVVL/tasksapp.git`;
  `git push -u origin main`; verify `git ls-remote` + API-проверка содержимого
  (нет `.env`/`.db`/uploads).

## Риски / заметки

- Повторное снятие скриншотов: `/tmp/opencode/shot.py` + venv `/tmp/opencode/shotenv`
  (системный Chrome, `channel="chrome"`), вход `director` (локальный пароль — см. сессию).
- Демо-данные недели создаются через API (login → POST `/api/weekly-lists/` → POST `/api/tasks/`).
- Фоновые процессы запускать через `setsid nohup ... < /dev/null &` в отдельном
  bash-вызове (pkill -f самоубийство + таймаут оболочки убивают обычный `&`).
- `pkill -f` убивает сам вызов — kill и старт серверов в разных вызовах.
