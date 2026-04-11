from fastapi import FastAPI, HTTPException, status, Depends, WebSocket, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from starlette.middleware.sessions import SessionMiddleware
from authlib.integrations.starlette_client import OAuth
from authlib.integrations.base_client.errors import OAuthError
from sqlalchemy.orm import Session
from typing import Optional

from dotenv import load_dotenv
load_dotenv()

from database import get_db, init_db
from schemas import ScoreSubmission, ScoreResponse, GameListItem, GameConfig, AuthUserResponse
from crud import (
    get_game, get_all_games, get_player_score,
    create_score, update_score, get_leaderboard, get_all_words,
    upsert_google_user, get_user_by_id
)
from config import (
    CORS_ORIGINS, CORS_ALLOW_ALL, MIN_SCORE, MIN_USERNAME_LENGTH, MAX_USERNAME_LENGTH,
    GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SESSION_SECRET_KEY, SESSION_COOKIE_SECURE
)
from profanity_filter import validate_and_clean_username
from websocket import handle_race_websocket, handle_parchis_websocket
from pathlib import Path
from functools import lru_cache
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

app = FastAPI(
        docs_url=None,
        redoc_url=None,
        openapi_url=None
        )

init_db()

app.add_middleware(
    ProxyHeadersMiddleware,
    trusted_hosts="*"
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if CORS_ALLOW_ALL else CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

app.add_middleware(
    SessionMiddleware,
    secret_key=SESSION_SECRET_KEY,
    same_site="lax",
    https_only=SESSION_COOKIE_SECURE,
)

TEMPLATES = Path("templates")
GOOGLE_OAUTH_ENABLED = bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)
oauth = OAuth()
if GOOGLE_OAUTH_ENABLED:
    oauth.register(
        name="google",
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile"},
    )


def get_current_user(request: Request, db: Session):
    user_id = request.session.get("user_id")
    if not user_id:
        return None
    user = get_user_by_id(db, int(user_id))
    if not user:
        request.session.clear()
        return None
    return user


def resolve_authenticated_player_name(user) -> str:
    """Build a valid leaderboard name from authenticated user data."""
    raw_name = (user.full_name or user.email.split("@")[0] or "Usuario").strip()
    if len(raw_name) > MAX_USERNAME_LENGTH:
        raw_name = raw_name[:MAX_USERNAME_LENGTH]
    clean_name = validate_and_clean_username(raw_name)
    if len(clean_name) < MIN_USERNAME_LENGTH:
        clean_name = "Usuario"
    return clean_name


@lru_cache(maxsize=1)
def build_page() -> str:
    html = (TEMPLATES/"index.html").read_text()
    css  = (TEMPLATES/"style.css").read_text()
    js   = (TEMPLATES/"app.js").read_text()
    html = html.replace('<link rel="stylesheet" href="style.css">', f"<style>{css}</style>")
    html = html.replace('<script src="app.js"></script>', f"<script>{js}</script>")
    return html


@app.get("/", response_class=HTMLResponse)
@app.get("/page", response_class=HTMLResponse)
async def get_full_page():
    return HTMLResponse(content=build_page())


@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request, db: Session = Depends(get_db)):
    if get_current_user(request, db):
        return RedirectResponse(url="/", status_code=status.HTTP_302_FOUND)
    return HTMLResponse(content=(TEMPLATES / "login.html").read_text())


@app.get("/register", response_class=HTMLResponse)
async def register_page(request: Request, db: Session = Depends(get_db)):
    if get_current_user(request, db):
        return RedirectResponse(url="/", status_code=status.HTTP_302_FOUND)
    return HTMLResponse(content=(TEMPLATES / "register.html").read_text())


@app.get("/auth/google/login")
async def auth_google_login(request: Request):
    if not GOOGLE_OAUTH_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth is not configured.",
        )
    redirect_uri = str(request.url_for("auth_google_callback"))
    return await oauth.google.authorize_redirect(request, redirect_uri, prompt="select_account")


@app.get("/auth/google/callback", name="auth_google_callback")
async def auth_google_callback(request: Request, db: Session = Depends(get_db)):
    if not GOOGLE_OAUTH_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth is not configured.",
        )
    try:
        token = await oauth.google.authorize_access_token(request)
    except OAuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Google auth failed: {exc.error}",
        ) from exc

    userinfo = token.get("userinfo")
    if not userinfo:
        userinfo = await oauth.google.parse_id_token(request, token)
    if not userinfo:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing Google user info.")

    email = userinfo.get("email")
    sub = userinfo.get("sub")
    email_verified = bool(userinfo.get("email_verified"))
    if not email or not sub:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google email not available.")
    if not email_verified:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google email is not verified.")

    user = upsert_google_user(
        db=db,
        email=email,
        provider_subject=sub,
        full_name=userinfo.get("name"),
        avatar_url=userinfo.get("picture"),
    )
    request.session["user_id"] = user.id
    return RedirectResponse(url="/", status_code=status.HTTP_302_FOUND)


@app.post("/auth/logout")
def auth_logout(request: Request):
    request.session.clear()
    return JSONResponse(content={"status": "success"})


@app.get("/api/auth/me", response_model=AuthUserResponse)
def get_auth_me(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return AuthUserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        avatar_url=user.avatar_url
    )


@app.get("/api/games")
def list_games(db: Session = Depends(get_db)):
    """Returns a lightweight list of games for the frontend launcher."""
    games = get_all_games(db)
    return [
        GameListItem(id=game.id, title=game.title, type=game.type, icon=game.icon)
        for game in games
    ]


@app.get("/api/games/speed-typing/words")
def get_typing_words(language: str = "es", db: Session = Depends(get_db)):
    """Returns a list of words for the typing game from database."""
    word_objects = get_all_words(db, language=language)
    words = [w.word for w in word_objects]
    return {"words": words}


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
def submit_score(submission: ScoreSubmission, request: Request, db: Session = Depends(get_db)):
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
    user = get_current_user(request, db)
    score_owner_name = resolve_authenticated_player_name(user) if user else "Anónimo"
    clean_username = validate_and_clean_username(score_owner_name)

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


@app.websocket("/ws/race")
async def race_websocket(websocket: WebSocket, player_name: str = "Player"):
    """WebSocket endpoint for multiplayer typing race matchmaking and gameplay."""
    await handle_race_websocket(websocket, player_name)


@app.websocket("/ws/parchis")
async def parchis_websocket(websocket: WebSocket, player_name: str = "Player"):
    """WebSocket endpoint for 4-player Parchis game matchmaking and gameplay."""
    await handle_parchis_websocket(websocket, player_name)
