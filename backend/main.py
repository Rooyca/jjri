from fastapi import FastAPI, HTTPException, status, Depends, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db, init_db
from schemas import ScoreSubmission, ScoreResponse, GameListItem, GameConfig
from crud import (
    get_game, get_all_games, get_player_score, 
    create_score, update_score, get_leaderboard, get_all_words
)
from config import CORS_ORIGINS, CORS_ALLOW_ALL, MIN_SCORE, MIN_USERNAME_LENGTH, MAX_USERNAME_LENGTH
from profanity_filter import validate_and_clean_username
from websocket import handle_race_websocket, handle_parchis_websocket

app = FastAPI()

init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if CORS_ALLOW_ALL else CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/api/games")
def list_games(db: Session = Depends(get_db)):
    """Returns a lightweight list of games for the frontend launcher."""
    games = get_all_games(db)
    return [
        GameListItem(id=game.id, title=game.title, type=game.type, icon=game.icon)
        for game in games
    ]

@app.get("/api/games/{game_id}")
def get_game_config(game_id: str, db: Session = Depends(get_db)):
    """Returns the full JSON config for a specific game."""
    game = get_game(db, game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    return GameConfig(
        id=game.id,
        title=game.title,
        type=game.type,
        icon=game.icon,
        duration_seconds=game.duration_seconds,
        max_plausible_score=game.max_plausible_score,
        settings=game.settings
    )

@app.post("/api/scores")
def submit_score(submission: ScoreSubmission, db: Session = Depends(get_db)):
    """Validates the score against the config and saves it to database."""
    game = get_game(db, submission.game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    if submission.score > game.max_plausible_score:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Score rejected: Implausible result."
        )
    
    if submission.score < MIN_SCORE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Score must be at least {MIN_SCORE} point(s)."
        )
    
    clean_username = validate_and_clean_username(submission.player_name)
    
    if len(clean_username) < MIN_USERNAME_LENGTH or len(clean_username) > MAX_USERNAME_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Username must be between {MIN_USERNAME_LENGTH} and {MAX_USERNAME_LENGTH} characters."
        )
    
    existing_score = get_player_score(db, submission.game_id, clean_username)
    
    if existing_score:
        if submission.score > existing_score.score:
            updated_score = update_score(
                db, existing_score, submission.score, 
                submission.duration_ms, submission.game_version
            )
            return {
                "status": "success",
                "message": "Score updated (new high score!)",
                "id": updated_score.id
            }
        else:
            return {
                "status": "ignored",
                "message": "Score not saved (not higher than existing score)",
                "id": existing_score.id
            }
    else:
        new_score = create_score(
            db, submission.game_id, clean_username, submission.score,
            submission.duration_ms, submission.game_version
        )
        return {
            "status": "success",
            "message": "Score saved successfully",
            "id": new_score.id
        }

@app.get("/api/leaderboard")
def show_leaderboard(game_id: Optional[str] = None, limit: int = 10, 
                     db: Session = Depends(get_db)):
    """Get top scores, optionally filtered by game."""
    scores = get_leaderboard(db, game_id, limit)
    
    return [
        ScoreResponse(
            game_id=score.game_id,
            player_name=score.player_name,
            score=score.score,
            duration_ms=score.duration_ms,
            submitted_at=score.submitted_at.isoformat() if score.submitted_at else None
        )
        for score in scores
    ]

@app.get("/api/games/speed-typing/words")
def get_typing_words(language: str = "es", db: Session = Depends(get_db)):
    """Returns a list of words for the typing game from database."""
    word_objects = get_all_words(db, language=language)
    words = [w.word for w in word_objects]
    return {"words": words}

@app.websocket("/ws/race")
async def race_websocket(websocket: WebSocket, player_name: str = "Player"):
    """WebSocket endpoint for multiplayer typing race matchmaking and gameplay."""
    await handle_race_websocket(websocket, player_name)

@app.websocket("/ws/parchis")
async def parchis_websocket(websocket: WebSocket, player_name: str = "Player"):
    """WebSocket endpoint for 4-player Parchis game matchmaking and gameplay."""
    await handle_parchis_websocket(websocket, player_name)
