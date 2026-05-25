# DnDGo — Virtual Tabletop for D&D 5e

[![Go](https://img.shields.io/badge/Go-1.25-00ADD8?style=flat-square&logo=go&logoColor=white)](https://golang.org)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql&logoColor=white)](https://postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)](https://docs.docker.com/compose/)
[![WebSocket](https://img.shields.io/badge/WebSocket-real--time-4CAF50?style=flat-square)](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)

Браузерный виртуальный стол для игры в D&D 5e. Боевые карты с токенами, туман войны, инициатива, кубики, листы персонажей и бестиарий — в реальном времени через WebSocket.

---

## Стек

| Слой | Технологии |
|---|---|
| **Backend** | Go 1.25, chi router, pgx v5, gorilla/websocket |
| **Frontend** | Next.js 16, React 19, Tailwind CSS, Konva.js, Zustand |
| **База данных** | PostgreSQL 16, golang-migrate (23 миграции) |
| **Аутентификация** | JWT HS256, bcrypt, Resend (email) |
| **Инфраструктура** | Docker Compose, nginx |

---

## Быстрый старт

### Требования

- Docker Desktop 4.x+
- Git

### Запуск

```bash
git clone https://github.com/zzzpize/dndgo.git
cd dndgo

cp .env.example .env
# Обязательно: POSTGRES_PASSWORD, JWT_SECRET
# Опционально: RESEND_API_KEY, RESEND_FROM (для email-верификации и сброса пароля)

docker compose up --build
```

Приложение будет доступно на **http://localhost** (nginx, порт 80).

### Переменные окружения

| Переменная | Описание | Обязательно |
|---|---|---|
| `POSTGRES_PASSWORD` | Пароль PostgreSQL | да |
| `JWT_SECRET` | Секрет для подписи JWT | да |
| `RESEND_API_KEY` | API-ключ Resend для отправки писем | нет |
| `RESEND_FROM` | Адрес отправителя писем | нет |

Без `RESEND_*` регистрация и смена email работают без верификации, сброс пароля недоступен.

### Порты (dev)

| Сервис | Порт |
|---|---|
| nginx (точка входа) | 80 |
| backend | 8080 |
| frontend | 3000 |
| postgres | 5433 |

---

## Возможности

### Аутентификация и аккаунт

- Регистрация с подтверждением email (опционально через Resend)
- Вход по email **или** username + пароль
- Сброс пароля через письмо со ссылкой (токен живёт 1 час)
- Управление аккаунтом (`/account`): смена логина, email, пароля

### Комнаты

- Создание комнаты с автогенерацией 6-символьного кода
- Присоединение по коду
- Роли: **Мастер подземелий (ДМ)** и **Игрок**
- Переименование, удаление комнаты; выход игрока
- **Настройки прав игроков** (7 тогглов, только ДМ):
  - Перемещать токены / Открывать туман войны
  - Редактировать токены / Изменять HP / Редактировать лист
  - Видеть броски ДМ / Бросать кубики

### Игровой стол (реальное время через WebSocket)

**Карта**
- Загрузка фонового изображения (jpg/png/webp, до 20 МБ) — только ДМ
- Сброс карты (`MAP_CLEAR`) без потери токенов
- Полная очистка сессии (`SESSION_CLEAR`) — удаляет всё

**Сетка**
- Включение/выключение, свободный размер клетки

**Туман войны**
- ДМ рисует/стирает круговые области (`reveal` / `hide`)
- Игроки видят туман с непрозрачностью 0.92, ДМ — 0.45

**Токены**
- Размещение drag-and-drop из панели ДМ
- Перемещение: ДМ — любые, игрок — только свои PC (по правам)
- Live-синхронизация drag (`TOKEN_DRAG`) для всех участников
- HP-бар (зелёный / жёлтый / красный), серый оверлей при HP = 0
- Временные HP: урон сначала поглощается temp_hp
- Удаление клавишей Delete/Backspace или кнопкой ✕
- Клик по строке в панели ДМ → выделяет токен на карте

**Инициатива**
- Трекер очерёдности, подсветка активного токена пульсирующим кольцом
- Авто-бросок инициативы, завершение боя

**Кубики**
- Нотация `XdY±Z` (`2d6+3`), быстрые кнопки d4–d100
- Бросок обрабатывается на сервере, результат бродкастится
- Лог бросков в нижней панели; настройка видимости бросков ДМ

**Линейка**
- Измерение расстояний в футах, синхронизированная для всех

### Персонажи

**Глобальные шаблоны** (`/characters`)
- Создание, редактирование, удаление шаблонов — переносимы в любую комнату
- Поля: имя, раса, класс, уровень, характеристики, HP, КД, заклинания, инвентарь

**Игровые экземпляры в комнате**
- Шаблон «берётся» в комнату через TemplatePicker — создаётся экземпляр персонажа
- Лист: шапка → HP-секция → вкладки **[Бой | Характеристики | Заклинания | Инвентарь]**
- HP-контролы: ±1, ±5, произвольная дельта, временные HP
- **Отвязка**: игрок может отвязать своего персонажа от токена (токен остаётся на карте)
- **Возврат**: через TemplatePicker → «Вернуться к персонажу»
- **Экспорт в шаблоны**: `POST /api/v1/characters/{id}/export-template`; при конфликте имени — 409 с выбором «Перезаписать / Создать дубль»

### НПС

- Создание/редактирование записей НПС, организация в папки
- **Бестиарий**: 2865 монстров, полнотекстовый поиск на русском
- Лист НПС: HP, КД, характеристики, вкладки [Бой | Характеристики]
- **Токен НПС — независимый инстанс**: редактирование токена на карте (HP, КД, имя, расположение) **не меняет** запись НПС во вкладке «НПС». Запись НПС редактируется только напрямую из панели, вне контекста токена.

### max_hp — текстовое поле

Во всех листах максимальное HP принимает несколько форматов:

| Значение | Поведение |
|---|---|
| `"20"` | Обычное числовое ограничение |
| `"20 (2d10+8)"` | Число + аннотация с кубиком, хранится как есть |
| `"Inf"` или `"∞"` | Бесконечные HP: кнопки урона/лечения — no-op |

Невалидный ввод (начинается не с цифры и не является Inf) → ошибка валидации, не сохраняется.

---

## API (краткий справочник)

```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
GET    /api/v1/auth/me
PATCH  /api/v1/auth/account/username
POST   /api/v1/auth/account/email/request
POST   /api/v1/auth/account/email/confirm
PATCH  /api/v1/auth/account/password
POST   /api/v1/auth/forgot-password
POST   /api/v1/auth/reset-password

GET    /api/v1/rooms
POST   /api/v1/rooms
POST   /api/v1/rooms/join
GET    /api/v1/rooms/:code
DELETE /api/v1/rooms/:code
PATCH  /api/v1/rooms/:code
GET    /api/v1/rooms/:code/settings
PATCH  /api/v1/rooms/:code/settings
POST   /api/v1/rooms/:code/map
DELETE /api/v1/rooms/:code/map
GET    /api/v1/rooms/:code/characters
GET    /api/v1/rooms/:code/npcs

POST   /api/v1/characters
GET    /api/v1/characters/:id
PUT    /api/v1/characters/:id
PATCH  /api/v1/characters/:id/hp
DELETE /api/v1/characters/:id
POST   /api/v1/characters/:id/export-template
GET    /api/v1/characters/templates
POST   /api/v1/characters/templates
PUT    /api/v1/characters/templates/:id
DELETE /api/v1/characters/templates/:id

GET    /api/v1/npcs
POST   /api/v1/npcs
GET    /api/v1/npcs/:id
PUT    /api/v1/npcs/:id
DELETE /api/v1/npcs/:id

GET    /api/v1/bestiary?q=&page=&limit=
GET    /api/v1/bestiary/:id

GET    /api/v1/ws/:code?token=<jwt>
```

---

## WebSocket события

```
TOKEN_CREATE / MOVE / DRAG / UPDATE / EDIT / DELETE
FOG_REVEAL / HIDE / CLEAR / FILL
MAP_UPDATE / MAP_CLEAR
SESSION_CLEAR / GRID_UPDATE
INIT_UPDATE / NEXT / END
RULER_UPDATE
DICE_ROLL / DICE_ROLL_RESULT / DICE_LOG_CLEAR
ROOM_RENAMED / ROOM_DELETED
DM_PRESENCE
CHARACTER_UPDATE
FULL_STATE_UPDATE
SETTINGS_UPDATE
```

---

## Roadmap

- [ ] Загрузка кастомных изображений для токенов
- [ ] Чат в комнате
- [ ] Несколько карт в одной комнате
- [ ] Мобильная адаптация
- [ ] Экспорт истории сессии

---

## English summary

DnDGo is a browser-based virtual tabletop for D&D 5e with real-time WebSocket sync.

**Stack:** Go 1.25 backend, Next.js 16 / React 19 frontend, PostgreSQL 16, Docker Compose + nginx.

**Features:** battle maps with fog of war, drag-and-drop tokens with HP bars and death overlay, initiative tracker, synchronized dice rolling (XdY±Z notation), distance ruler, character sheets with tabs (Combat / Stats / Spells / Inventory), global character templates, NPC management with a 2865-monster Russian bestiary, player permission toggles per room, account management (username / email / password change, password reset via email).
