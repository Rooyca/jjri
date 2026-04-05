from sqlalchemy import Column, Integer, String, DateTime, Index, JSON
from datetime import datetime, timezone
from database import Base


class Score(Base):
    """Player scores for games."""
    __tablename__ = "scores"

    id = Column(Integer, primary_key=True, index=True)
    game_id = Column(String, nullable=False, index=True)
    player_name = Column(String, nullable=False)
    score = Column(Integer, nullable=False)
    duration_ms = Column(Integer)
    game_version = Column(String)
    submitted_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    __table_args__ = (
        Index('idx_scores_leaderboard', 'game_id', 'score'),
        Index('idx_player_game', 'player_name', 'game_id'),
    )


class Game(Base):
    """Game configuration and metadata."""
    __tablename__ = "games"

    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    type = Column(String, nullable=False)
    icon = Column(String, nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    max_plausible_score = Column(Integer, nullable=False)
    settings = Column(JSON, default=dict)


class Word(Base):
    """Word list for typing game."""
    __tablename__ = "words"

    id = Column(Integer, primary_key=True, index=True)
    word = Column(String, nullable=False, unique=True, index=True)
    language = Column(String, default="es")
    category = Column(String, nullable=True)
