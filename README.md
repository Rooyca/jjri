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

## Quick Start

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

### Adding New Games

To register a new game:

1. Add game to `/backend/static/games/{game-id}/`
2. Create game JavaScript module implementing the required interface
3. Insert game metadata into the database via `init_games.py`
4. The frontend will automatically discover and load the new game

No frontend code modifications are required.
