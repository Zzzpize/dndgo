# DnDGo — Virtual Tabletop for D&D 5e / Виртуальный стол для D&D 5e

[![Go](https://img.shields.io/badge/Go-1.23-00ADD8?style=flat-square&logo=go&logoColor=white)](https://golang.org)
[![Next.js](https://img.shields.io/badge/Next.js-15-000000?style=flat-square&logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql&logoColor=white)](https://postgresql.org)
[![Kafka](https://img.shields.io/badge/Apache_Kafka-7.6-231F20?style=flat-square&logo=apachekafka)](https://kafka.apache.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)](https://docs.docker.com/compose/)
[![WebSocket](https://img.shields.io/badge/WebSocket-real--time-4CAF50?style=flat-square)](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)

---

### О проекте

DnDGo — виртуальный стол для игры в Dungeons & Dragons 5e. Боевые карты с токенами, туман войны, инициатива, броски кубиков в реальном времени, листы персонажей и поиск по бестиарию.

### Технологический стек

| Слой | Технологии |
|---|---|
| **Backend** | Go 1.23, chi router, pgx v5, gorilla/websocket |
| **Frontend** | Next.js 15, React 19, Tailwind CSS, Konva.js, Zustand |
| **База данных** | PostgreSQL 16, golang-migrate |
| **Очередь событий** | Apache Kafka (event sourcing всех игровых действий) |
| **Аутентификация** | JWT HS256, bcrypt |
| **Инфраструктура** | Docker Compose, nginx |

### Быстрый старт

#### Требования
- Docker Desktop 4.x+
- Git

#### Запуск (production)

```bash
git clone https://github.com/zzzpize/dndgo.git
cd dndgo

# Скопируйте переменные окружения
cp .env.example .env
# Отредактируйте .env: задайте POSTGRES_PASSWORD и JWT_SECRET

# Запустить только production-сборку (без dev-оверрайда)
docker compose -f docker-compose.yml up --build
```

Приложение будет доступно на **http://localhost** (nginx, порт 80).

#### Запуск в dev-режиме (с hot-reload)

```bash
docker compose up --build
```

Dev-режим включает:
- Go backend с Air (автоперезагрузка при изменении `.go` файлов)
- Next.js с `next dev` (HMR для фронтенда)

#### Переменные окружения

| Переменная | Описание | По умолчанию |
|---|---|---|
| `POSTGRES_PASSWORD` | Пароль PostgreSQL | — (обязательно) |
| `JWT_SECRET` | Секрет для JWT | — (обязательно) |
| `PUBLIC_URL` | Публичный URL бэкенда (для ссылок на карты) | `http://localhost` |
| `STATIC_DIR` | Директория для статических файлов | `./static` |

### Текущие возможности

#### Аутентификация
- Регистрация и вход по email + пароль
- JWT-токен в localStorage, автовосстановление сессии

#### Комнаты
- Создание комнаты с автогенерацией 6-символьного кода
- Присоединение по коду
- Роли: **Мастер подземелий (ДМ)** и **Игрок**

#### Игровой стол (реальное время через WebSocket)
- **Боевая карта** — загрузка фонового изображения (jpg/png/webp, до 20 МБ)
- **Токены** — размещение, перетаскивание, удаление; HP-бар (зелёный/жёлтый/красный)
- **Сетка** — включение/выключение, настройка размера клетки
- **Туман войны** — рисование/стирание DM'ом (игроки видят непрозрачный туман)
- **Инициатива** — трекер очерёдности ходов с пульсирующим маркером активного
- **Измерение расстояний** — линейка (Ruler overlay)
- **Броски кубиков** — нотация XdY±Z, обрабатываются на сервере, результат бродкастится всем

#### Персонажи
- CRUD листов персонажей
- Вкладки: Бой / Характеристики / Заклинания / Инвентарь
- Изменение HP (delta), модификаторы считаются автоматически

#### Бестиарий
- 2859 монстров с полнотекстовым поиском на русском языке
- Быстрое размещение монстра на карту как NPC-токен

#### Event Sourcing
- Все игровые события публикуются в Kafka и сохраняются в `game_events`
- История событий по комнате: `GET /api/v1/rooms/:code/events`

### В разработке

- [ ] Protobuf-сериализация Kafka-сообщений
- [ ] gRPC как внутренний транспорт
- [ ] Загрузка кастомных изображений токенов
- [ ] Чат в комнате
- [ ] Поддержка нескольких карт в одной комнате
- [ ] Экспорт истории сессии в PDF
- [ ] Мобильная адаптация
- [ ] И многое, многое другое

---

### About

DnDGo is a browser-based virtual tabletop for Dungeons & Dragons 5e. It features real-time battle maps with tokens, fog of war, initiative tracking, dice rolling, character sheets, and a searchable bestiary of 2859 monsters.

### Tech Stack

| Layer | Technologies |
|---|---|
| **Backend** | Go 1.23, chi router, pgx v5, gorilla/websocket |
| **Frontend** | Next.js 15, React 19, Tailwind CSS, Konva.js, Zustand |
| **Database** | PostgreSQL 16, golang-migrate |
| **Event Queue** | Apache Kafka (event sourcing for all game actions) |
| **Auth** | JWT HS256, bcrypt |
| **Infrastructure** | Docker Compose, nginx |

### Quick Start

#### Requirements
- Docker Desktop 4.x+
- Git

#### Production

```bash
git clone https://github.com/zzzpize/dndgo.git
cd dndgo

cp .env.example .env
# Edit .env: set POSTGRES_PASSWORD and JWT_SECRET

docker compose -f docker-compose.yml up --build
```

Open **http://localhost** in your browser.

#### Development (hot-reload)

```bash
docker compose up --build
```

Dev mode includes:
- Go backend with Air (auto-reload on `.go` file changes)
- Next.js `next dev` with HMR

#### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `POSTGRES_PASSWORD` | PostgreSQL password | — (required) |
| `JWT_SECRET` | JWT signing secret | — (required) |
| `PUBLIC_URL` | Public backend URL (for map image links) | `http://localhost` |
| `STATIC_DIR` | Directory for uploaded static files | `./static` |

### Current Features

#### Authentication
- Register and login with email + password
- JWT stored in localStorage with automatic session restore

#### Rooms
- Create a room with an auto-generated 6-character code
- Join by code
- Roles: **Dungeon Master (DM)** and **Player**

#### Game Table (real-time via WebSocket)
- **Battle map** — upload background image (jpg/png/webp, up to 20 MB)
- **Tokens** — place, drag, delete; HP bar (green/yellow/red)
- **Grid** — toggle and configure cell size
- **Fog of War** — DM draws/erases; players see opaque fog
- **Initiative tracker** — turn order with pulsing active-turn ring
- **Distance ruler** — overlay measurement tool
- **Dice rolling** — XdY±Z notation, server-side rolls broadcast to all

#### Characters
- Full character sheet CRUD
- Tabs: Combat / Stats / Spells / Inventory
- HP delta updates; modifiers computed automatically

#### Bestiary
- 2859 monsters with Russian full-text search
- One-click monster placement as NPC token on the map

#### Event Sourcing
- All game events published to Kafka and persisted in `game_events`
- Room event history: `GET /api/v1/rooms/:code/events`

### Roadmap

- [ ] Protobuf serialization for Kafka messages (`.proto` already defined)
- [ ] gRPC as internal transport layer
- [ ] Custom token image uploads
- [ ] In-room chat
- [ ] Multiple maps per room
- [ ] Session export to PDF
- [ ] Mobile-friendly layout
- [ ] And more, more other things...

---

## API Reference

```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
GET    /api/v1/auth/me

POST   /api/v1/rooms
GET    /api/v1/rooms
POST   /api/v1/rooms/join
GET    /api/v1/rooms/:code
DELETE /api/v1/rooms/:code
POST   /api/v1/rooms/:code/map
GET    /api/v1/rooms/:code/characters
GET    /api/v1/rooms/:code/events

POST   /api/v1/characters
GET    /api/v1/characters/:id
PUT    /api/v1/characters/:id
PATCH  /api/v1/characters/:id/hp
DELETE /api/v1/characters/:id

GET    /api/v1/bestiary?q=&page=&limit=
GET    /api/v1/bestiary/:id

GET    /api/v1/ws/:code?token=<jwt>
```