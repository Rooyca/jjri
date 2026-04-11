import os

CORS_ORIGINS = [
    "https://app.yachaycodex.dev",
    "https://ron.x52.uk",
]

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
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
