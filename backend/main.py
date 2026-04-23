from fastapi import FastAPI, HTTPException, status, Depends, WebSocket, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse, FileResponse
from starlette.middleware.sessions import SessionMiddleware
from authlib.integrations.starlette_client import OAuth
from authlib.integrations.base_client.errors import OAuthError
from sqlalchemy.orm import Session
from typing import Optional
from urllib.parse import urlparse
import logging
import time
import uuid
from datetime import datetime, timezone, timedelta

from dotenv import load_dotenv
load_dotenv()

from database import get_db, init_db
from schemas import (
    ScoreSubmission, ScoreResponse, GameListItem, GameConfig, AuthUserResponse,
    GameAttemptStartRequest, GameAttemptStartResponse
)
from crud import (
    get_game, get_all_games, get_player_score,
    create_score, update_score, get_leaderboard, get_all_words,
    upsert_google_user, get_user_by_id, create_game_attempt, get_game_attempt, consume_game_attempt
)
from config import (
    CORS_ORIGINS, CORS_ALLOW_ALL, MIN_SCORE, MIN_USERNAME_LENGTH, MAX_USERNAME_LENGTH,
    GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SESSION_SECRET_KEY, SESSION_COOKIE_SECURE,
    SESSION_COOKIE_SAMESITE, SECURITY_HEADERS_ENABLED, CSRF_ORIGIN_CHECK_ENABLED,
    TRUSTED_IFRAME_ORIGINS
)
from profanity_filter import validate_and_clean_username
from websocket import handle_race_websocket, handle_parchis_websocket, handle_chatroom_websocket
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
    allow_headers=["Content-Type", "X-Requested-With", "X-Request-ID"],
    expose_headers=["X-Request-ID"],
)

app.add_middleware(
    SessionMiddleware,
    secret_key=SESSION_SECRET_KEY,
    same_site=SESSION_COOKIE_SAMESITE,
    https_only=SESSION_COOKIE_SECURE,
)

logger = logging.getLogger("juegos_jri")
if not logger.handlers:
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s %(levelname)s %(message)s'
    )

ALLOWED_ORIGINS = set(CORS_ORIGINS)
ATTEMPT_EXPIRY_GRACE_SECONDS = 30


def request_origin(request: Request) -> Optional[str]:
    origin = request.headers.get("origin")
    if not origin:
        return None
    parsed = urlparse(origin)
    if not parsed.scheme or not parsed.netloc:
        return None
    return f"{parsed.scheme}://{parsed.netloc}"


def same_origin(request: Request, origin: str) -> bool:
    request_origin_url = f"{request.url.scheme}://{request.url.netloc}"
    return request_origin_url == origin


def enforce_origin_for_state_change(request: Request):
    if not CSRF_ORIGIN_CHECK_ENABLED:
        return
    origin = request_origin(request)
    if not origin:
        return
    if origin in ALLOWED_ORIGINS or same_origin(request, origin):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Forbidden origin for state-changing request."
    )


@app.middleware("http")
async def request_context_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    started = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = round((time.perf_counter() - started) * 1000, 2)

    response.headers["X-Request-ID"] = request_id
    logger.info(
        "request_id=%s method=%s path=%s status=%s duration_ms=%s origin=%s",
        request_id,
        request.method,
        request.url.path,
        response.status_code,
        elapsed_ms,
        request.headers.get("origin", "-")
    )
    return response


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    if not SECURITY_HEADERS_ENABLED:
        return response

    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"

    connect_sources = ["'self'", "https:", "wss:"]
    csp_parts = [
        "default-src 'self'",
        "img-src 'self' data: https:",
        "style-src 'self' 'unsafe-inline'",
        "script-src 'self' 'unsafe-inline' https:",
        f"connect-src {' '.join(connect_sources)}",
        "object-src 'none'",
        "base-uri 'self'"
    ]
    if TRUSTED_IFRAME_ORIGINS:
        frame_ancestors = " ".join(["'self'", *TRUSTED_IFRAME_ORIGINS])
        csp_parts.append(f"frame-ancestors {frame_ancestors}")
    response.headers["Content-Security-Policy"] = "; ".join(csp_parts)
    return response

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


def normalize_utc_datetime(dt: datetime) -> datetime:
    """
    Normalize datetimes coming from SQLite to timezone-aware UTC.
    SQLite commonly returns naive datetimes even if values were written with UTC.
    """
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def require_authenticated_user(request: Request, db: Session):
    user = get_current_user(request, db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Inicia sesión para guardar puntajes en la tabla."
        )
    return user


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


@app.get("/healthz")
async def healthz():
    return JSONResponse(content={"status": "ok"})


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


@app.get("/style.css")
async def style_css():
    return FileResponse(TEMPLATES / "style.css", media_type="text/css")


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
    enforce_origin_for_state_change(request)
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


@app.post("/api/game-attempts/start", response_model=GameAttemptStartResponse)
def start_game_attempt(payload: GameAttemptStartRequest, request: Request, db: Session = Depends(get_db)):
    enforce_origin_for_state_change(request)
    user = require_authenticated_user(request, db)
    game = get_game(db, payload.game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    now = datetime.now(timezone.utc)
    duration_seconds = game.duration_seconds or 60
    expires_at = now + timedelta(seconds=duration_seconds + ATTEMPT_EXPIRY_GRACE_SECONDS)
    attempt_id = str(uuid.uuid4())
    attempt = create_game_attempt(
        db=db,
        attempt_id=attempt_id,
        user_id=user.id,
        game_id=game.id,
        expires_at=expires_at
    )
    return GameAttemptStartResponse(
        attempt_id=attempt.id,
        expires_at=attempt.expires_at.isoformat()
    )


@app.post("/api/scores")
def submit_score(submission: ScoreSubmission, request: Request, db: Session = Depends(get_db)):
    """Validates the score against the config and saves it to database."""
    enforce_origin_for_state_change(request)
    user = require_authenticated_user(request, db)
    game = get_game(db, submission.game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    attempt = get_game_attempt(db, submission.attempt_id)
    if not attempt:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid game attempt.")
    if attempt.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Attempt ownership mismatch.")
    if attempt.game_id != submission.game_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Attempt game mismatch.")
    if attempt.consumed_at is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Attempt already consumed.")

    now = datetime.now(timezone.utc)
    attempt_expires_at = normalize_utc_datetime(attempt.expires_at)
    attempt_started_at = normalize_utc_datetime(attempt.started_at)

    if attempt_expires_at < now:
        consume_game_attempt(db, attempt)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Attempt expired.")

    if submission.score > game.max_plausible_score:
        consume_game_attempt(db, attempt)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Score rejected: Implausible result."
        )
    if submission.score < MIN_SCORE:
        consume_game_attempt(db, attempt)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Score must be at least {MIN_SCORE} point(s)."
        )
    elapsed_ms = int((now - attempt_started_at).total_seconds() * 1000)
    if elapsed_ms < 1000:
        consume_game_attempt(db, attempt)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Attempt finished too quickly."
        )

    score_owner_name = resolve_authenticated_player_name(user)
    clean_username = validate_and_clean_username(score_owner_name)

    if len(clean_username) < MIN_USERNAME_LENGTH or len(clean_username) > MAX_USERNAME_LENGTH:
        consume_game_attempt(db, attempt)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Username must be between {MIN_USERNAME_LENGTH} and {MAX_USERNAME_LENGTH} characters."
        )
    existing_score = get_player_score(db, submission.game_id, clean_username)
    canonical_duration_ms = elapsed_ms

    if existing_score:
        if submission.score > existing_score.score:
            updated_score = update_score(
                db, existing_score, submission.score,
                canonical_duration_ms, submission.game_version
            )
            consume_game_attempt(db, attempt)
            return {
                "status": "success",
                "message": "Score updated (new high score!)",
                "id": updated_score.id
            }
        else:
            consume_game_attempt(db, attempt)
            return {
                "status": "ignored",
                "message": "Score not saved (not higher than existing score)",
                "id": existing_score.id
            }
    else:
        new_score = create_score(
            db, submission.game_id, clean_username, submission.score,
            canonical_duration_ms, submission.game_version
        )
        consume_game_attempt(db, attempt)
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


@app.websocket("/ws/chatroom")
async def chatroom_websocket(websocket: WebSocket, player_name: str = "Player"):
    """WebSocket endpoint for shared chatroom."""
    await handle_chatroom_websocket(websocket, player_name)
