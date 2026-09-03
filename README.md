# ReconEDGE AI

**AI Finance Controller for Automated Financial Reconciliation**

## Current Phase

**Phase 1 — Foundation Setup**

This phase establishes the project architecture, authentication system, and placeholder UI. No reconciliation logic, AI functionality, or financial data processing has been implemented yet.

## Tech Stack

### Frontend
- React.js (Vite)
- Tailwind CSS
- React Router
- Axios
- Lucide React

### Backend
- Node.js + Express.js
- MongoDB + Mongoose
- JWT + bcryptjs

## Project Structure

```
recon-edge-ai/
├── client/          # React frontend
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── contexts/      # React contexts
│   │   ├── layouts/       # Page layouts
│   │   ├── pages/         # Page components
│   │   ├── services/      # API services
│   │   └── utils/         # Utility functions
│   └── ...
├── server/          # Express backend
│   ├── config/      # Configuration (DB)
│   ├── controllers/ # Request handlers
│   ├── middleware/   # Auth, error handling
│   ├── models/      # Mongoose schemas
│   ├── routes/      # API routes
│   ├── services/    # Business logic
│   └── utils/       # Utility functions
├── data/            # Data storage
└── README.md
```

## Setup

### Prerequisites
- Node.js (v18+)
- MongoDB (running locally or connection string)

### Installation

```bash
# Install root dependencies
npm install

# Install client dependencies
cd client
npm install

# Install server dependencies
cd ../server
npm install
```

### Environment Variables

```bash
cd server
cp .env.example .env
```

Edit `.env` with your values:
- `MONGODB_URI` — MongoDB connection string
- `JWT_SECRET` — Secret key for JWT signing
- `GEMINI_API_KEY` — Gemini API key (for future phases)
- `CLIENT_URL` — Frontend URL (default: http://localhost:5173)

### Running

```bash
# From root — runs both client and server
npm run dev

# Or run individually:
cd server && npm run dev
cd client && npm run dev
```

## API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/health` | Health check | No |
| POST | `/api/auth/register` | Register user | No |
| POST | `/api/auth/login` | Login user | No |
| GET | `/api/auth/me` | Get current user | Yes |

## Frontend Routes

| Route | Page | Auth Required |
|-------|------|---------------|
| `/login` | Login | No |
| `/register` | Register | No |
| `/dashboard` | Dashboard | Yes |
| `/reconciliation` | Reconciliation | Yes |
| `/exceptions` | Exceptions | Yes |
| `/audit-logs` | Audit Logs | Yes |
