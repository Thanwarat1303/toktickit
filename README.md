# TokTickIT 
# TokTickIT

CPE334 Lab 1 - TokTickIT Full-Stack Hello World Starter.

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

## Run the Application

Start the backend in one terminal:

```powershell
cd server
npm run dev
```

The API runs at `http://localhost:3000`.

Start the frontend in another terminal:

```powershell
cd client
npm run dev
```

Open the URL shown by Vite, usually `http://localhost:5173`.

## Run Tests

Run backend tests:

```powershell
cd server
npm test
```

Run frontend tests:

```powershell
cd client
npm test
```

Additional API, database, and UI behavior is implemented in later Lab 1 issues.