# TokTickIT

TokTickIT is a simple IT service desk application developed for CPE334 Lab 1.

The application can check the system status and display the supported IT request categories from the backend API.

## Technology Stack

- Frontend: React, TypeScript, Vite, Bootstrap
- Backend: Node.js, Express, TypeScript
- Database: PostgreSQL running in Docker
- ORM: Prisma
- Testing: Vitest and Supertest

## Prerequisites

Install:

- Node.js and npm
- Docker Desktop

Start Docker Desktop before running the database.

## Install Dependencies

Install the frontend dependencies:

```powershell
cd client
npm install
```

Install the backend dependencies:

```powershell
cd ../server
npm install
```

## Start PostgreSQL

Create the local PostgreSQL container:

```powershell
docker run --name tocktickit-postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=YOUR_LOCAL_POSTGRES_PASSWORD -e POSTGRES_DB=toktickit_lab1 -p 15433:5432 -v tocktickit_postgres_data:/var/lib/postgresql/data -d postgres:17
```

If the container has already been created and stopped, start it again:

```powershell
docker start tocktickit-postgres
```

## Configure the Backend

Copy the example environment file:

```powershell
cd server
Copy-Item .env.example .env
```

Edit `server/.env` and replace `YOUR_LOCAL_POSTGRES_PASSWORD` with your local database password.

Do not commit the `.env` file.

## Database Setup

After PostgreSQL is running and `server/.env` has been configured, run the Prisma migration:

```powershell
cd server
npx prisma migrate dev
```

Seed the database with the IT request categories:

```powershell
npx prisma db seed
```

The seeded categories are:

- Account and Access
- Hardware
- Software
- Network

The seed uses Prisma `upsert`, so it can be run more than once without creating duplicate categories.

## Run the Application

### Backend

Start the backend in one terminal:

```powershell
cd server
npm run dev
```

The API runs at:

```text
http://localhost:3000
```

### Frontend

Start the frontend in another terminal:

```powershell
cd client
npm run dev
```

Open the URL shown by Vite, usually:

```text
http://localhost:5173
```

Click **Check System** to check the backend status and display the available IT request categories.

## API Endpoints

### Health Check

```text
GET /api/health
```

The endpoint returns the TokTickIT API health status.

Example response:

```json
{
  "status": "ok",
  "service": "TokTickIT API"
}
```

### Categories

```text
GET /api/categories
```

The endpoint reads the categories from PostgreSQL and returns them in ID order.

The supported categories are:

- Account and Access
- Hardware
- Software
- Network

## Run Tests

### Backend Tests

Run:

```powershell
cd server
npm test
```

The backend tests cover:

- `GET /api/health`
- `GET /api/categories`

### Frontend Tests

Run:

```powershell
cd client
npm test
```

The frontend tests cover:

- TokTickIT heading
- Online status and category list
- Offline/error state when the API is unavailable