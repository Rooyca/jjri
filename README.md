# 🎮 Dynamic Game Platform

A modular web-based gaming platform featuring dynamic game loading and centralized leaderboard management.

## Overview

This platform implements a **backend-driven architecture** where games are dynamically loaded and configured entirely from the server. The frontend acts as a universal game launcher, capable of rendering any game without prior knowledge of its implementation. This decoupled design enables seamless addition of new games without frontend modifications.

### Key Features

- **Dynamic Game Loading**: Games are registered in the backend and loaded on-demand via API
- **Frontend-Agnostic Architecture**: The client adapts to any game configuration provided by the server
- **Centralized Leaderboard System**: Unified scoring and ranking across all games
- **Real-time Multiplayer Support**: WebSocket-based synchronization for competitive gameplay
- **Profanity Filtering**: Automatic content moderation for player usernames
- **Anti-cheat Validation**: Server-side score validation with game-specific constraints 

## Technology Stack

**Backend Layer:**

- **FastAPI** - High-performance REST API and WebSocket server
- **SQLAlchemy** - Database ORM and query builder
- **SQLite** - Embedded relational database
- **better-profanity** - Content moderation filter
- **Uvicorn** - ASGI server implementation
- **Pydantic** - Data validation and serialization

**Frontend Layer:**

- **Vanilla JavaScript** - Zero-dependency client implementation
- **HTML5 Canvas API** - Hardware-accelerated game rendering
- **CSS3** - Responsive layout and styling
- **WebSocket API** - Real-time bidirectional communication

**Infrastructure:**

- **Nginx** - Reverse proxy and static file server
- **Docker & Docker Compose** - Containerized deployment
- **Persistent Volumes** - Database state preservation
- **Bridge Networking** - Isolated container communication

## Available Games

The platform currently includes five games, each with unique mechanics and scoring systems:

1. **Arithmetic Challenge** 🧮  
   Solve sequential arithmetic operations under time pressure (60-second rounds). Tests mental calculation speed and accuracy.

2. **Canyon Runner** 🦖  
   Endless runner inspired by the Chrome offline game. Navigate obstacles using precise timing and reflexes.

3. **Velocity Typing** ⌨️  
   Type randomly generated words as quickly as possible within 60 seconds. Measures typing speed and accuracy.

4. **Block Cascade** 🧱  
   Classic block-stacking puzzle game. Arrange falling pieces to complete and clear rows.

5. **Type Racer** 🏁  
   Multiplayer real-time typing competition. Race against other players with WebSocket synchronization.

> **Note:** All games are loaded dynamically from the backend. The frontend retrieves game metadata, assets, and logic through API endpoints, allowing new games to be added by simply registering them in the database.

## Quick Start

### Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+

### Deployment

```bash
# Start all services
docker-compose up -d

# Monitor application logs
docker-compose logs -f

# Stop all services
docker-compose down
```

**Access Points:**

- Frontend: `http://localhost:8080`
- Backend API: `http://localhost:8000`
- API Documentation: `http://localhost:8000/docs`

## Project Structure

```
final_games/
├── backend/
│   ├── main.py              # FastAPI application entry point
│   ├── models.py            # SQLAlchemy database models (Score, Game, Word)
│   ├── schemas.py           # Pydantic validation schemas
│   ├── crud.py              # Database CRUD operations
│   ├── database.py          # SQLAlchemy configuration and session management
│   ├── websocket.py         # WebSocket handler for multiplayer sessions
│   ├── profanity_filter.py  # Username content moderation
│   ├── init_games.py        # Game registration and seeding
│   ├── init_words.py        # Word dictionary seeding for typing games
│   └── static/games/        # Games
│
└── frontend/
    ├── index.html           # Main application shell
    ├── app.js               # Game launcher and API integration
    ├── style.css            # Global styles and theming
    └── nginx.conf           # Nginx reverse proxy configuration
```

## API Reference

### REST Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/games` | Retrieve all registered games with metadata |
| `GET` | `/api/games/{id}` | Fetch configuration and assets for a specific game |
| `GET` | `/api/games/speed-typing/words` | Retrieve word list for typing games |
| `POST` | `/api/scores` | Submit player score with validation |
| `GET` | `/api/leaderboard` | Query global rankings with optional filters |

### WebSocket Endpoints

| Endpoint | Protocol | Description |
|----------|----------|-------------|
| `/ws/race/{room_id}` | WebSocket | Real-time multiplayer session for Type Racer |

## Architecture Highlights

### Backend-Driven Dynamic Loading

The platform's core innovation is its **server-controlled game architecture**:

- **Game Registration**: New games are added by inserting records into the database with metadata (name, description, module path, scoring rules)
- **Runtime Discovery**: The frontend queries `/api/games` to discover available games at runtime
- **On-Demand Loading**: Game JavaScript modules and assets are fetched only when selected
- **Zero Frontend Updates**: Adding new games requires no changes to the client codebase

This design pattern enables:
- Hot-swapping game implementations
- A/B testing different game versions
- Conditional game availability based on server logic
- Centralized game configuration management

### Additional Features

- **Real-time Multiplayer**: WebSocket-based state synchronization for competitive typing races
- **Server-Side Validation**: Score submissions are validated against game-specific maximum thresholds
- **Data Persistence**: SQLite database stored in Docker volumes survives container restarts
- **Content Moderation**: Automatic profanity filtering for all user-submitted usernames

## Local Development

### Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Initialize database
python init_db.py

# Start development server with hot reload
uvicorn main:app --reload --port 8000
```

### Frontend Setup

The frontend is framework-free and can be served by any HTTP server:

```bash
cd frontend

# Option 1: Python HTTP server
python -m http.server 8080

# Option 2: Node.js http-server
npx http-server -p 8080

# Option 3: PHP built-in server
php -S localhost:8080
```

## Implementation Notes

### Score Validation
All score submissions undergo server-side validation. Each game defines maximum score thresholds to prevent impossible or tampered values.

### Content Moderation
The platform uses `better-profanity` with Spanish language dictionaries to filter inappropriate usernames before database persistence.

### Session Management
Multiplayer typing race rooms automatically expire after 5 minutes of inactivity to prevent resource leaks.

### Asset Management
Games are stored in `/backend/static/games/` and served directly from the backend. This centralizes game management and enables the frontend to remain stateless.

### Adding New Games

To register a new game:

1. Add game to `/backend/static/games/{game-id}/`
2. Create game JavaScript module implementing the required interface
3. Insert game metadata into the database via `init_games.py`
4. The frontend will automatically discover and load the new game

No frontend code modifications are required.

## License

MIT License
