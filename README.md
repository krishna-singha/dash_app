# DASHPlayer

A DASH video streaming application with a FastAPI backend and a React/Vite
frontend.

## Prerequisites

- Python 3.10 or newer
- Node.js and npm

## Start the project

Run the backend and frontend in separate terminals.

### 1. Start the FastAPI server

From the repository root:

```bash
cd server
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The API runs at <http://127.0.0.1:8000>.

To make the API accessible from other devices on the network, use:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Start the React client

In a second terminal, from the repository root:

```bash
cd client
npm install
npm run dev
```

Open the client at <http://localhost:5173>.

The backend health check is available at
<http://127.0.0.1:8000/api/health>.

## Available client commands

Run these commands from the `client` directory:

```bash
npm run dev      # Start the Vite development server
npm run build    # Type-check and create a production build
npm run lint     # Run ESLint
npm run preview  # Preview the production build
```