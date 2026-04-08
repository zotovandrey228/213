# 🖨️ Cartridge Management System

A full-stack cartridge management system with NestJS backend, React frontend, MSSQL database, and Telegram bot integration.

## Stack

- **Backend**: NestJS + TypeORM + MSSQL
- **Frontend**: React (Vite) + TypeScript
- **Telegram Bot**: node-telegram-bot-api + OpenAI Whisper
- **Infrastructure**: Docker Compose

## Quick Start

### 1. Configure environment

```bash
# Edit .env with your values (DB password, JWT secret, Telegram token, OpenAI key)
```

### 2. Start with Docker Compose

```bash
docker-compose up --build -d
```

### 3. Run the seed script (creates admin user)

```bash
docker-compose exec backend npm run seed
```

### 4. Access the application

- **Frontend**: http://localhost
- **Backend API**: http://localhost:3000
- **Default credentials**: `admin` / `admin123`

## User Roles

| Role    | Permissions                          |
|---------|--------------------------------------|
| admin   | Full access (users, CRUD everything) |
| editor  | Read + write cartridges/works/notes  |
| viewer  | Read-only access                     |

## API Endpoints

### Auth
- `POST /auth/login` — Login, returns JWT token

### Users (admin only)
- `GET /users` — List all users
- `GET /users/me` — Get current user
- `POST /users` — Create user
- `PUT /users/:id` — Update user
- `DELETE /users/:id` — Delete user

### Cartridges
- `GET /cartridges?search=q` — List cartridges (with optional search)
- `GET /cartridges/:id` — Get cartridge with works and notes
- `POST /cartridges` — Create cartridge (editor/admin)
- `PUT /cartridges/:id` — Update cartridge (editor/admin)
- `DELETE /cartridges/:id` — Delete cartridge (admin)

### Works
- `GET /works/cartridge/:cartridgeId` — List works for cartridge
- `POST /works` — Add work entry (editor/admin)
- `DELETE /works/:id` — Delete work (editor/admin)

### Notes
- `GET /notes/cartridge/:cartridgeId` — List notes for cartridge
- `POST /notes` — Add note (editor/admin)
- `DELETE /notes/:id` — Delete note (editor/admin)

## Telegram Bot

1. Create a bot via [@BotFather](https://t.me/BotFather)
2. Set `TELEGRAM_BOT_TOKEN` in `.env`
3. Set user's `tg_id` via the Admin Panel (get it from [@userinfobot](https://t.me/userinfobot))

### Bot Commands
- `/start` — Start interaction, shows menu
- Text messages — Contextual interaction (search cartridge, add work/note)
- Voice messages — Transcribed via OpenAI Whisper (requires `OPENAI_API_KEY`)

## Development

### Backend

```bash
cd backend
npm install
npm run start:dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Seed database

```bash
cd backend
npm run seed
```

## Environment Variables

| Variable             | Description                          | Default                  |
|----------------------|--------------------------------------|--------------------------|
| `DB_HOST`            | MSSQL server host                    | `db`                     |
| `DB_PORT`            | MSSQL server port                    | `1433`                   |
| `DB_USERNAME`        | Database username                    | `sa`                     |
| `DB_PASSWORD`        | Database password                    | `YourStrong@Password123` |
| `DB_DATABASE`        | Database name                        | `cartridge_db`           |
| `JWT_SECRET`         | JWT signing secret                   | *(required)*             |
| `JWT_EXPIRES_IN`     | JWT expiry                           | `7d`                     |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token from BotFather    | *(optional)*             |
| `OPENAI_API_KEY`     | OpenAI API key for Whisper           | *(optional)*             |
| `PORT`               | Backend port                         | `3000`                   |