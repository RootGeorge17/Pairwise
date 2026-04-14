# PairWise - Collaborate with Friends on Coding Tasks

## Features

## Installation Prerequisites

## Installation

### Backend Configuration

Set these environment variables before starting the backend:

- `PAIRWISE_DB_URL`
- `PAIRWISE_DB_USERNAME`
- `PAIRWISE_DB_PASSWORD`
- `PAIRWISE_JPA_SHOW_SQL`

Create your local env file:

```bash
cp backend/.env.example backend/.env
```

Load it and run the backend:

```bash
set -a
source backend/.env
set +a
cd backend && mvn spring-boot:run
```
