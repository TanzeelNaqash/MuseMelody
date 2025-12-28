# Database Setup Instructions

## Option 1: Use Neon (Cloud PostgreSQL) - Recommended

1. Go to [Neon Console](https://console.neon.tech/)
2. Create a new project
3. Copy the connection string
4. Update your `.env` file:
   ```env
   DATABASE_URL=your-neon-connection-string-here
   ```

## Option 2: Install PostgreSQL Locally

### Windows:
1. Download PostgreSQL from [postgresql.org](https://www.postgresql.org/download/windows/)
2. Install with default settings
3. Set password for 'postgres' user
4. Create database:
   ```sql
   CREATE DATABASE aerogroove_dev;
   ```
5. Update `.env` file:
   ```env
   DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/aerogroove_dev
   ```

### macOS:
```bash
brew install postgresql
brew services start postgresql
createdb aerogroove_dev
```

### Linux (Ubuntu/Debian):
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo -u postgres createdb aerogroove_dev
```

## After Database Setup:

1. Run: `npm run db:setup`
2. Run: `npm run dev`

## Quick Test with Docker (Alternative):

If you have Docker installed:
```bash
docker run --name aerogroove-postgres -e POSTGRES_PASSWORD=password -e POSTGRES_DB=aerogroove_dev -p 5432:5432 -d postgres:15
```

Then update `.env`:
```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/aerogroove_dev
```
