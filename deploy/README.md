# Развёртывание TextureTasks на сервере

## 1. Подготовка сервера (Ubuntu 22.04)

```bash
# Подключиться к серверу
ssh root@IP_СЕРВЕРА

# Установка зависимостей
apt update && apt upgrade -y
apt install -y python3-venv nginx certbot python3-certbot-nginx git
```

## 2. Копирование проекта

```bash
# Создать директорию
mkdir -p /opt/texturetasks

# Скопировать файлы проекта (выполнить на локальной машине)
rsync -avz --exclude 'backend/venv' --exclude 'backend/__pycache__' --exclude 'frontend/node_modules' --exclude 'frontend/dist' --exclude '.git' /home/kun/Документы/Default\ Project/ root@IP_СЕРВЕРА:/opt/texturetasks/
```

## 3. Настройка бэкенда

```bash
cd /opt/texturetasks/backend

# Создать виртуальное окружение
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Создать .env для продакшена
cat > .env << 'EOF'
DATABASE_URL=sqlite+aiosqlite:///./dev.db
SECRET_KEY=ЗДЕСЬ_СЛУЧАЙНЫЙ_64_СИМВОЛА
DOMAIN=https://texturetasks.ru
EOF

# Сгенерировать SECRET_KEY
python3 -c "import secrets; print(''.join(secrets.choice('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()') for _ in range(64)))"
```

## 4. Запуск seed

```bash
cd /opt/texturetasks/backend
source venv/bin/activate

# Для просмотра пароля (сгенерируется случайный):
python -m app.seed

# Или задать свой пароль:
python -m app.seed "мой_надёжный_пароль"
```

## 5. Настройка systemd

```bash
cp /opt/texturetasks/deploy/texturetasks.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now texturetasks
systemctl status texturetasks
```

## 6. Настройка Nginx

```bash
cp /opt/texturetasks/deploy/texturetasks.nginx /etc/nginx/sites-available/texturetasks
ln -s /etc/nginx/sites-available/texturetasks /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

## 7. SSL-сертификат (HTTPS)

```bash
certbot --nginx -d texturetasks.ru -d www.texturetasks.ru
```

## 8. Сборка фронтенда (на локальной машине перед копированием)

```bash
cd /home/kun/Документы/Default\ Project/frontend
npx vite build
```

## 9. Резервное копирование (cron)

```bash
crontab -e
# Добавить строку:
0 3 * * * /opt/texturetasks/backend/venv/bin/python /opt/texturetasks/backend/app/services/backup_service.py
```

Но в проекте уже есть фоновый worker для бэкапов (каждые 24ч).

## 10. Проверка

```bash
curl https://texturetasks.ru/health
# Должен вернуть: {"status":"ok"}
```

Открой https://texturetasks.ru в браузере и войди как director / твой_пароль.
