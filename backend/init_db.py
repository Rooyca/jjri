from database import init_db, SessionLocal
from crud import get_all_words
from init_games import populate_games
from init_words import populate_words

def should_populate_words():
    """Only seed words when the list is empty."""
    db = SessionLocal()
    try:
        words = get_all_words(db)
        return len(words) == 0
    except Exception as e:
        print(f"Words check failed, will initialize: {e}")
        return True
    finally:
        db.close()

def initialize_database():
    """Initialize database schema and populate with initial data."""
    print("Initializing database...")
    
    # Create tables
    init_db()
    print("Database schema created.")
    
    # Sync games on each startup (upsert in create_game keeps this idempotent)
    print("Populating games...")
    populate_games()

    # Seed words only once to avoid duplicates
    if should_populate_words():
        print("Populating words...")
        populate_words()
    else:
        print("Words already populated, skipping words initialization.")

    print("Database initialization complete!")

if __name__ == "__main__":
    initialize_database()
