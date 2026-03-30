from pathlib import Path
from database import init_db, SessionLocal
from crud import get_all_games, get_all_words
from init_games import populate_games
from init_words import populate_words

def should_initialize_db():
    """Check if database needs initialization."""
    db = SessionLocal()
    try:
        # Check if games exist
        games = get_all_games(db)
        words = get_all_words(db)
        return len(games) == 0 or len(words) == 0
    except Exception as e:
        # If tables don't exist or any error, initialize
        print(f"Database check failed, will initialize: {e}")
        return True
    finally:
        db.close()

def initialize_database():
    """Initialize database schema and populate with initial data."""
    print("Initializing database...")
    
    # Create tables
    init_db()
    print("Database schema created.")
    
    # Check if we need to populate
    if should_initialize_db():
        print("Populating games...")
        populate_games()
        
        print("Populating words...")
        populate_words()
        
        print("Database initialization complete!")
    else:
        print("Database already populated, skipping initialization.")

if __name__ == "__main__":
    initialize_database()
