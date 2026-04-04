from database import SessionLocal, init_db
from crud import create_game

def populate_games():
    """Populate the games table with initial game configs."""
    init_db()
    db = SessionLocal()
    
    try:
        games_config = [
            {
                "game_id": "speed-maths",
                "title": "Speed Maths",
                "game_type": "quiz",
                "icon": "🧮",
                "duration_seconds": 60,
                "max_plausible_score": 150,
                "settings": {"operations": ["+", "-", "*"], "max_operand": 10}
            },
            {
                "game_id": "dino-game",
                "title": "Dino Game",
                "game_type": "runner",
                "icon": "🦖",
                "duration_seconds": None,
                "max_plausible_score": 1000,
                "settings": {}
            },
            {
                "game_id": "speed-typing",
                "title": "Speed Typing",
                "game_type": "typing",
                "icon": "⌨️",
                "duration_seconds": 60,
                "max_plausible_score": 100,
                "settings": {"word_list_url": "/api/games/speed-typing/words"}
            },
            {
                "game_id": "block-stacker",
                "title": "Block Stacker",
                "game_type": "stacker",
                "icon": "🧱",
                "duration_seconds": None,
                "max_plausible_score": 200,
                "settings": {}
            },
            {
                "game_id": "typing-race",
                "title": "Typing Race",
                "game_type": "typing_race",
                "icon": "🏁",
                "duration_seconds": None,
                "max_plausible_score": 200,
                "settings": {"word_count": 30}
            },
            {
                "game_id": "parchis",
                "title": "Parchís",
                "game_type": "parchis",
                "icon": "🎲",
                "duration_seconds": None,
                "max_plausible_score": 100,
                "settings": {"players": 4}
            }
        ]
        
        for game_data in games_config:
            create_game(db, **game_data)
            print(f"Created game: {game_data['title']}")
        
        print("Games table populated successfully!")
    finally:
        db.close()

if __name__ == "__main__":
    populate_games()
