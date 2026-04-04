import asyncio
import uuid
import random
from dataclasses import dataclass, field
from typing import List, Optional, Dict
from datetime import datetime, timezone
from fastapi import WebSocket, WebSocketDisconnect

from crud import get_all_words, create_score, update_score, get_player_score
from database import SessionLocal


# ============ PARCHIS GAME CLASSES ============

@dataclass
class ParchisPlayer:
    """Represents a player in a Parchis game."""
    websocket: WebSocket
    name: str
    player_index: int
    pieces: List[Dict] = field(default_factory=lambda: [
        {"position": -1, "in_home": True},
        {"position": -1, "in_home": True},
        {"position": -1, "in_home": True},
        {"position": -1, "in_home": True}
    ])
    finished: bool = False
    finish_time: Optional[float] = None


@dataclass
class ParchisRoom:
    """Tracks state for a 4-player Parchis game."""
    room_id: str
    players: List[ParchisPlayer]
    current_player: int = 0
    state: str = "waiting"  # waiting | playing | finished
    start_time: Optional[float] = None
    winner_index: Optional[int] = None
    winner_name: Optional[str] = None
    last_dice_value: int = 0


class ParchisMatchmaker:
    """Singleton matchmaker for 4-player Parchis games."""
    
    def __init__(self):
        self.queue: List[ParchisPlayer] = []
        self.rooms: Dict[str, ParchisRoom] = {}
        self.player_to_room: Dict[WebSocket, str] = {}
        self.lock = asyncio.Lock()
    
    async def add_player(self, websocket: WebSocket, player_name: str) -> Optional[ParchisRoom]:
        """
        Add a player to the matchmaking queue.
        If 4 players are waiting, create a game room and return it.
        Otherwise, return None (player is waiting).
        """
        async with self.lock:
            player = ParchisPlayer(
                websocket=websocket,
                name=player_name,
                player_index=len(self.queue)
            )
            self.queue.append(player)
            
            # Broadcast updated player count to all waiting players
            for p in self.queue:
                try:
                    await p.websocket.send_json({
                        "type": "player_joined",
                        "player_count": len(self.queue)
                    })
                except:
                    pass
            
            if len(self.queue) >= 4:
                # Pop four players from queue
                players = [self.queue.pop(0) for _ in range(4)]
                
                # Reassign player indices
                for idx, p in enumerate(players):
                    p.player_index = idx
                
                # Create game room
                room = await self._create_game_room(players)
                
                # Track room assignments
                self.rooms[room.room_id] = room
                for player in players:
                    self.player_to_room[player.websocket] = room.room_id
                
                return room
            
            return None
    
    async def _create_game_room(self, players: List[ParchisPlayer]) -> ParchisRoom:
        """Create a new Parchis game room."""
        room_id = str(uuid.uuid4())
        
        return ParchisRoom(
            room_id=room_id,
            players=players,
            current_player=0,
            state="waiting"
        )
    
    async def remove_player(self, websocket: WebSocket):
        """Remove a player from queue or notify others if in a room."""
        async with self.lock:
            # Remove from queue if waiting
            self.queue = [p for p in self.queue if p.websocket != websocket]
            
            # Check if player was in a room
            room_id = self.player_to_room.pop(websocket, None)
            if room_id and room_id in self.rooms:
                room = self.rooms[room_id]
                
                # Notify other players
                for player in room.players:
                    if player.websocket != websocket:
                        try:
                            await player.websocket.send_json({
                                "type": "player_disconnected",
                                "message": "A player disconnected"
                            })
                        except:
                            pass
                
                # Clean up room
                del self.rooms[room_id]
                for player in room.players:
                    self.player_to_room.pop(player.websocket, None)
    
    def get_room(self, websocket: WebSocket) -> Optional[ParchisRoom]:
        """Get the game room for a given websocket."""
        room_id = self.player_to_room.get(websocket)
        if room_id:
            return self.rooms.get(room_id)
        return None


# Global Parchis matchmaker instance
parchis_matchmaker = ParchisMatchmaker()


async def handle_parchis_websocket(websocket: WebSocket, player_name: str):
    """
    Main WebSocket handler for 4-player Parchis game.
    Manages matchmaking, game state, and message routing.
    """
    await websocket.accept()
    
    try:
        # Add player to matchmaker
        await websocket.send_json({
            "type": "waiting",
            "player_count": len(parchis_matchmaker.queue)
        })
        
        room = await parchis_matchmaker.add_player(websocket, player_name)
        
        if room:
            # 4 players found! Start the game
            await start_parchis_game(room)
        
        # Listen for messages
        while True:
            data = await websocket.receive_json()
            
            room = parchis_matchmaker.get_room(websocket)
            if not room:
                await websocket.send_json({
                    "type": "error",
                    "message": "No active game room"
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
            if data["type"] == "roll_dice":
                await handle_dice_roll(room, current_player)
    
    except WebSocketDisconnect:
        pass
    
    except Exception as e:
        print(f"Parchis WebSocket error: {e}")
    
    finally:
        await parchis_matchmaker.remove_player(websocket)


async def start_parchis_game(room: ParchisRoom):
    """Send start message to all players and begin the game."""
    room.state = "playing"
    room.start_time = datetime.now(timezone.utc).timestamp()
    
    for idx, player in enumerate(room.players):
        try:
            await player.websocket.send_json({
                "type": "game_start",
                "room_id": room.room_id,
                "your_player_index": idx,
                "game_state": get_game_state(room)
            })
        except:
            pass
    
    # Notify whose turn it is
    await notify_current_player(room)


def get_game_state(room: ParchisRoom) -> dict:
    """Get current game state for broadcasting."""
    return {
        "current_player": room.current_player,
        "players": [
            {
                "name": p.name,
                "pieces": p.pieces,
                "finished": p.finished
            }
            for p in room.players
        ],
        "last_dice_value": room.last_dice_value
    }


async def handle_dice_roll(room: ParchisRoom, current_player: ParchisPlayer):
    """Handle a dice roll action."""
    if room.state != "playing":
        return
    
    # Check if it's this player's turn
    if room.players[room.current_player].websocket != current_player.websocket:
        await current_player.websocket.send_json({
            "type": "error",
            "message": "Not your turn"
        })
        return
    
    # Roll the dice (1-6)
    dice_value = random.randint(1, 6)
    room.last_dice_value = dice_value
    
    # Simple move logic: move first piece that can move
    moved = False
    for piece in current_player.pieces:
        if piece["position"] == -1 and dice_value == 5:
            # Exit home with a 5
            piece["position"] = current_player.player_index * 17  # Starting position for each player
            piece["in_home"] = False
            moved = True
            break
        elif piece["position"] >= 0 and piece["position"] < 68:
            # Move forward
            new_pos = piece["position"] + dice_value
            if new_pos <= 68:
                piece["position"] = new_pos
                moved = True
                break
    
    # Check if player won
    if all(p["position"] == 68 for p in current_player.pieces):
        current_player.finished = True
        current_player.finish_time = datetime.now(timezone.utc).timestamp()
        room.state = "finished"
        room.winner_index = current_player.player_index
        room.winner_name = current_player.name
        await end_parchis_game(room)
        return
    
    # Broadcast dice roll result
    for player in room.players:
        try:
            await player.websocket.send_json({
                "type": "dice_rolled",
                "value": dice_value,
                "game_state": get_game_state(room)
            })
        except:
            pass
    
    # Next player's turn (unless rolled a 6)
    if dice_value != 6:
        room.current_player = (room.current_player + 1) % 4
        await notify_current_player(room)
    else:
        # Same player gets another turn
        await notify_current_player(room)


async def notify_current_player(room: ParchisRoom):
    """Notify all players whose turn it is."""
    for idx, player in enumerate(room.players):
        try:
            if idx == room.current_player:
                await player.websocket.send_json({"type": "your_turn"})
            else:
                await player.websocket.send_json({"type": "not_your_turn"})
        except:
            pass


async def end_parchis_game(room: ParchisRoom):
    """End the game and send results to all players."""
    duration_ms = int((datetime.now(timezone.utc).timestamp() - room.start_time) * 1000) if room.start_time else 0
    
    # Send results to all players
    for player in room.players:
        try:
            await player.websocket.send_json({
                "type": "game_over",
                "winner_index": room.winner_index,
                "winner_name": room.winner_name,
                "duration_ms": duration_ms
            })
        except:
            pass
    
    # Submit only winner's score to database
    await submit_parchis_score(room)


async def submit_parchis_score(room: ParchisRoom):
    """Submit winner's score to the database."""
    if room.winner_index is None:
        return
    
    db = SessionLocal()
    
    try:
        winner = room.players[room.winner_index]
        duration_ms = int((winner.finish_time - room.start_time) * 1000) if room.start_time and winner.finish_time else 0
        
        # Winner gets 100 points
        score = 100
        
        # Check existing score
        existing_score = get_player_score(db, "parchis", winner.name)
        
        if existing_score:
            if score > existing_score.score:
                update_score(db, existing_score, score, duration_ms, "1.0")
        else:
            create_score(db, "parchis", winner.name, score, duration_ms, "1.0")
    
    except Exception as e:
        print(f"Error submitting Parchis score: {e}")
    
    finally:
        db.close()


# ============ TYPING RACE CLASSES (existing) ============


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
