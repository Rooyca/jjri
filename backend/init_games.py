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
                "title": "MateRush",
                "game_type": "quiz",
                "icon": "🧮",
                "duration_seconds": 60,
                "max_plausible_score": 150,
                "settings": {"operations": ["+", "-", "*"], "max_operand": 10}
            },
            {
                "game_id": "dino-game",
                "title": "CuboSalto",
                "game_type": "runner",
                "icon": "🦖",
                "duration_seconds": None,
                "max_plausible_score": 1000,
                "settings": {}
            },
            {
                "game_id": "speed-typing",
                "title": "MecaRush",
                "game_type": "typing",
                "icon": "⌨️",
                "duration_seconds": 60,
                "max_plausible_score": 100,
                "settings": {"word_list_url": "/api/games/speed-typing/words"}
            },
            {
                "game_id": "block-stacker",
                "title": "TorreZ",
                "game_type": "stacker",
                "icon": "🧱",
                "duration_seconds": None,
                "max_plausible_score": 200,
                "settings": {}
            },
            {
                "game_id": "typing-race",
                "title": "TeclasPvP",
                "game_type": "typing_race",
                "icon": "🏁",
                "duration_seconds": None,
                "max_plausible_score": 200,
                "settings": {"word_count": 30}
            },
            {
                "game_id": "chat-room",
                "title": "Chat",
                "game_type": "chatroom",
                "icon": "💬",
                "duration_seconds": None,
                "max_plausible_score": 1,
                "settings": {"max_message_length": 250}
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
