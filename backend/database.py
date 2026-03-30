import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from config import DB_NAME

# Use environment variable if set, otherwise use local path
if os.getenv("DB_PATH"):
    DB_PATH = Path(os.getenv("DB_PATH"))
    # Ensure the directory exists
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
else:
    DB_PATH = Path(__file__).parent / DB_NAME

DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    """Get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """Initialize database with schema."""
    Base.metadata.create_all(bind=engine)
