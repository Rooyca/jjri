import asyncio
import uuid
import random
from dataclasses import dataclass, field
from typing import List, Optional, Dict
from datetime import datetime, timezone
from fastapi import WebSocket, WebSocketDisconnect

from crud import get_all_words, create_score, update_score, get_player_score
from database import SessionLocal


@dataclass
class Player:
    """Represents a player in the matchmaking queue or race."""
    websocket: WebSocket
    name: str
    word_index: int = 0
    wpm: int = 0
    finished: bool = False
    finish_time: Optional[float] = None


@dataclass
class RaceRoom:
    """Tracks state for one active race between two players."""
    room_id: str
    players: List[Player]
    words: List[str]
    state: str = "countdown"  # countdown | racing | finished
    start_time: Optional[float] = None
    finished_order: List[str] = field(default_factory=list)


class Matchmaker:
    """Singleton matchmaker that queues waiting players and creates race rooms."""
    
    def __init__(self):
        self.queue: List[Player] = []
        self.rooms: Dict[str, RaceRoom] = {}
        self.player_to_room: Dict[WebSocket, str] = {}
        self.lock = asyncio.Lock()
    
    async def add_player(self, websocket: WebSocket, player_name: str) -> Optional[RaceRoom]:
        """
        Add a player to the matchmaking queue.
        If 2+ players are waiting, create a race room and return it.
        Otherwise, return None (player is waiting).
        """
        async with self.lock:
            player = Player(websocket=websocket, name=player_name)
            self.queue.append(player)
            
            if len(self.queue) >= 2:
                # Pop two players from queue
                player1 = self.queue.pop(0)
                player2 = self.queue.pop(0)
                
                # Create race room
                room = await self._create_race_room([player1, player2])
                
                # Track room assignments
                self.rooms[room.room_id] = room
                self.player_to_room[player1.websocket] = room.room_id
                self.player_to_room[player2.websocket] = room.room_id
                
                return room
            
            return None
    
    async def _create_race_room(self, players: List[Player]) -> RaceRoom:
        """Create a new race room with random words."""
        room_id = str(uuid.uuid4())
        
        # Fetch words from database
        db = SessionLocal()
        try:
            word_objects = get_all_words(db, language="es")
            all_words = [w.word for w in word_objects]
        finally:
            db.close()
        
        # Select random words
        random.shuffle(all_words)
        words = all_words[:30]  # 30 words per race
        
        return RaceRoom(
            room_id=room_id,
            players=players,
            words=words,
            state="countdown"
        )
    
    async def remove_player(self, websocket: WebSocket):
        """Remove a player from queue or notify opponent if in a room."""
        async with self.lock:
            # Remove from queue if waiting
            self.queue = [p for p in self.queue if p.websocket != websocket]
            
            # Check if player was in a room
            room_id = self.player_to_room.pop(websocket, None)
            if room_id and room_id in self.rooms:
                room = self.rooms[room_id]
                
                # Notify opponent
                for player in room.players:
                    if player.websocket != websocket:
                        try:
                            await player.websocket.send_json({
                                "type": "opponent_disconnected"
                            })
                        except:
                            pass
                
                # Clean up room
                del self.rooms[room_id]
                for player in room.players:
                    self.player_to_room.pop(player.websocket, None)
    
    def get_room(self, websocket: WebSocket) -> Optional[RaceRoom]:
        """Get the race room for a given websocket."""
        room_id = self.player_to_room.get(websocket)
        if room_id:
            return self.rooms.get(room_id)
        return None


# Global matchmaker instance
matchmaker = Matchmaker()


async def handle_race_websocket(websocket: WebSocket, player_name: str):
    """
    Main WebSocket handler for multiplayer typing race.
    Manages matchmaking, race state, and message routing.
    """
    await websocket.accept()
    
    try:
        # Add player to matchmaker
        await websocket.send_json({"type": "waiting"})
        
        room = await matchmaker.add_player(websocket, player_name)
        
        if room:
            # Match found! Start the race
            await start_race(room)
        
        # Listen for messages
        while True:
            data = await websocket.receive_json()
            
            room = matchmaker.get_room(websocket)
            if not room:
                await websocket.send_json({
                    "type": "error",
                    "message": "No active race room"
                })
                continue
            
            # Find current player
            current_player = next(
                (p for p in room.players if p.websocket == websocket),
                None
            )
            
            if not current_player:
                continue
            
            # Handle different message types
            if data["type"] == "progress":
                await handle_progress(room, current_player, data)
            
            elif data["type"] == "finish":
                await handle_finish(room, current_player, data)
    
    except WebSocketDisconnect:
        pass
    
    except Exception as e:
        print(f"WebSocket error: {e}")
    
    finally:
        await matchmaker.remove_player(websocket)


async def start_race(room: RaceRoom):
    """Send start message to both players and begin countdown."""
    for player in room.players:
        try:
            await player.websocket.send_json({
                "type": "start",
                "room_id": room.room_id,
                "words": room.words,
                "countdown": 3
            })
        except:
            pass
    
    # Wait for countdown (3 seconds)
    await asyncio.sleep(3)
    
    # Transition to racing state
    room.state = "racing"
    room.start_time = datetime.now(timezone.utc).timestamp()


async def handle_progress(room: RaceRoom, current_player: Player, data: dict):
    """Broadcast player progress to opponent."""
    current_player.word_index = data.get("word_index", 0)
    current_player.wpm = data.get("wpm", 0)
    
    # Send to opponent
    for player in room.players:
        if player.websocket != current_player.websocket:
            try:
                await player.websocket.send_json({
                    "type": "opponent_progress",
                    "word_index": current_player.word_index,
                    "wpm": current_player.wpm
                })
            except:
                pass


async def handle_finish(room: RaceRoom, current_player: Player, data: dict):
    """
    Handle race finish.
    First player to finish wins - game ends immediately.
    Only winner's score is saved to database.
    """
    if current_player.finished:
        return  # Already finished
    
    current_player.finished = True
    current_player.finish_time = datetime.now(timezone.utc).timestamp()
    current_player.wpm = data.get("wpm", 0)
    room.finished_order.append(current_player.name)
    
    # Game ends immediately when first player finishes
    room.state = "finished"
    
    # Winner is the first (and currently only) player to finish
    winner_name = current_player.name
    winner = current_player
    
    # Send results to both players
    for player in room.players:
        is_winner = player.name == winner_name
        opponent = next((p for p in room.players if p != player), None)
        
        try:
            await player.websocket.send_json({
                "type": "result",
                "winner": winner_name,
                "your_wpm": player.wpm if player.finished else 0,
                "opponent_wpm": opponent.wpm if opponent and opponent.finished else 0,
                "is_winner": is_winner
            })
        except:
            pass
    
    # Submit only winner's score to database
    await submit_race_scores(room, winner_only=True)


async def submit_race_scores(room: RaceRoom, winner_only: bool = False):
    """
    Submit scores to the database.
    
    Args:
        room: The race room
        winner_only: If True, only save the first player to finish (winner)
    """
    db = SessionLocal()
    
    try:
        for player in room.players:
            if not player.finished:
                continue
            
            # If winner_only mode, only save the first finisher
            if winner_only and player.name != room.finished_order[0]:
                continue
            
            # Calculate duration
            duration_ms = int((player.finish_time - room.start_time) * 1000) if room.start_time and player.finish_time else 0
            
            # Use WPM as score
            score = player.wpm
            
            # Check existing score
            existing_score = get_player_score(db, "typing-race", player.name)
            
            if existing_score:
                if score > existing_score.score:
                    update_score(db, existing_score, score, duration_ms, "1.0")
            else:
                create_score(db, "typing-race", player.name, score, duration_ms, "1.0")
    
    except Exception as e:
        print(f"Error submitting race scores: {e}")
    
    finally:
        db.close()
