from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime, timezone
from typing import List, Optional
from models import Score, Game, Word, User, GameAttempt
from sqlalchemy.dialects.sqlite import insert 

def get_game(db: Session, game_id: str) -> Optional[Game]:
    """Get a game by ID."""
    return db.query(Game).filter(Game.id == game_id).first()

def get_all_games(db: Session) -> List[Game]:
    """Get all games."""
    return db.query(Game).all()

def get_player_score(db: Session, game_id: str, player_name: str) -> Optional[Score]:
    """Get a player's score for a specific game."""
    return db.query(Score).filter(
        Score.player_name == player_name,
        Score.game_id == game_id
    ).first()

def create_score(db: Session, game_id: str, player_name: str, score: int, 
                 duration_ms: int, game_version: str) -> Score:
    """Create a new score entry."""
    new_score = Score(
        game_id=game_id,
        player_name=player_name,
        score=score,
        duration_ms=duration_ms,
        game_version=game_version
    )
    db.add(new_score)
    db.commit()
    db.refresh(new_score)
    return new_score

def update_score(db: Session, existing_score: Score, score: int, 
                 duration_ms: int, game_version: str) -> Score:
    """Update an existing score entry."""
    existing_score.score = score
    existing_score.duration_ms = duration_ms
    existing_score.game_version = game_version
    existing_score.submitted_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(existing_score)
    return existing_score

def get_leaderboard(db: Session, game_id: Optional[str] = None, 
                    limit: int = 10) -> List[Score]:
    """Get top scores, optionally filtered by game."""
    query = db.query(Score).filter(Score.player_name != "Anónimo")
    
    if game_id:
        query = query.filter(Score.game_id == game_id)
    
    return query.order_by(desc(Score.score), Score.duration_ms).limit(limit).all()


def create_game_attempt(
    db: Session,
    attempt_id: str,
    user_id: int,
    game_id: str,
    expires_at: datetime
) -> GameAttempt:
    attempt = GameAttempt(
        id=attempt_id,
        user_id=user_id,
        game_id=game_id,
        expires_at=expires_at
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return attempt


def get_game_attempt(db: Session, attempt_id: str) -> Optional[GameAttempt]:
    return db.query(GameAttempt).filter(GameAttempt.id == attempt_id).first()


def consume_game_attempt(db: Session, attempt: GameAttempt) -> GameAttempt:
    attempt.consumed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(attempt)
    return attempt

def create_game(db: Session, game_id: str, title: str, game_type: str,
                duration_seconds: Optional[int], max_plausible_score: int,
                settings: dict, icon: Optional[str] = None) -> Game:
    
    stmt = insert(Game).values(
        id=game_id,
        title=title,
        type=game_type,
        icon=icon,
        duration_seconds=duration_seconds,
        max_plausible_score=max_plausible_score,
        settings=settings
    ).on_conflict_do_update(
        index_elements=['id'],
        set_=dict(title=title, type=game_type, icon=icon,
                  duration_seconds=duration_seconds,
                  max_plausible_score=max_plausible_score,
                  settings=settings)
    )
    db.execute(stmt)
    db.commit()
    return db.query(Game).filter(Game.id == game_id).first()

def get_all_words(db: Session, language: Optional[str] = None) -> List[Word]:
    """Get all words, optionally filtered by language."""
    query = db.query(Word)
    if language:
        query = query.filter(Word.language == language)
    return query.limit(100).all()

def create_word(db: Session, word: str, language: str = "es", 
                category: Optional[str] = None) -> Word:
    """Create a new word entry."""
    new_word = Word(word=word, language=language, category=category)
    db.add(new_word)
    db.commit()
    db.refresh(new_word)
    return new_word

def bulk_create_words(db: Session, words: List[str], language: str = "es",
                      category: Optional[str] = None):
    """Bulk insert words."""
    word_objects = [
        Word(word=word, language=language, category=category)
        for word in words
    ]
    db.bulk_save_objects(word_objects)
    db.commit()


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    """Get a user by ID."""
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    """Get a user by email."""
    return db.query(User).filter(User.email == email).first()


def upsert_google_user(
    db: Session,
    email: str,
    provider_subject: str,
    full_name: Optional[str] = None,
    avatar_url: Optional[str] = None
) -> User:
    """Create or update a Google-authenticated user."""
    existing_by_subject = db.query(User).filter(User.provider_subject == provider_subject).first()
    if existing_by_subject:
        existing_by_subject.email = email
        existing_by_subject.full_name = full_name
        existing_by_subject.avatar_url = avatar_url
        db.commit()
        db.refresh(existing_by_subject)
        return existing_by_subject

    existing_by_email = get_user_by_email(db, email)
    if existing_by_email:
        existing_by_email.provider = "google"
        existing_by_email.provider_subject = provider_subject
        existing_by_email.full_name = full_name
        existing_by_email.avatar_url = avatar_url
        db.commit()
        db.refresh(existing_by_email)
        return existing_by_email

    user = User(
        email=email,
        full_name=full_name,
        provider="google",
        provider_subject=provider_subject,
        avatar_url=avatar_url,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
