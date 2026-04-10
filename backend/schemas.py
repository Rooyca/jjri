from pydantic import BaseModel
from typing import Optional, Dict, Any

class ScoreSubmission(BaseModel):
    """Score submission from client."""
    game_id: str
    player_name: str
    score: int
    duration_ms: int
    game_version: str

class ScoreResponse(BaseModel):
    """Score response to client."""
    game_id: str
    player_name: str
    score: int
    duration_ms: Optional[int]
    submitted_at: Optional[str]

class GameListItem(BaseModel):
    """Lightweight game info for list view."""
    id: str
    title: str
    type: str
    icon: str = "🎮"

class GameConfig(BaseModel):
    """Full game configuration."""
    id: str
    title: str
    type: str
    icon: Optional[str] = None
    duration_seconds: Optional[int]
    max_plausible_score: int
    settings: Dict[str, Any]


class AuthUserResponse(BaseModel):
    id: int
    email: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
