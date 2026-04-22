import os

CORS_ORIGINS = [
    "https://app.yachaycodex.dev",
    "https://ron.x52.uk",
]
CORS_ORIGINS.extend(
    origin.strip()
    for origin in os.getenv("ADDITIONAL_CORS_ORIGINS", "").split(",")
    if origin.strip()
)

# Allow all origins for development
CORS_ALLOW_ALL = False

# Database
DB_NAME = "juegos_jri.db"

# Validation rules
MIN_SCORE = 1
MIN_USERNAME_LENGTH = 2
MAX_USERNAME_LENGTH = 20

# Auth
SESSION_SECRET_KEY = os.getenv("SESSION_SECRET_KEY", "change-this-in-production")
SESSION_COOKIE_SECURE = os.getenv("SESSION_COOKIE_SECURE", "true").lower() == "true"
SESSION_COOKIE_SAMESITE = os.getenv("SESSION_COOKIE_SAMESITE", "lax").lower()
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")

# Security and runtime hardening
SECURITY_HEADERS_ENABLED = os.getenv("SECURITY_HEADERS_ENABLED", "true").lower() == "true"
CSRF_ORIGIN_CHECK_ENABLED = os.getenv("CSRF_ORIGIN_CHECK_ENABLED", "true").lower() == "true"
TRUSTED_IFRAME_ORIGINS = [
    origin.strip()
    for origin in os.getenv("TRUSTED_IFRAME_ORIGINS", "").split(",")
    if origin.strip()
]
REQUEST_TIMEOUT_MS = int(os.getenv("REQUEST_TIMEOUT_MS", "10000"))
