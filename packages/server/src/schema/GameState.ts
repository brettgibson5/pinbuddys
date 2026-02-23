import { Schema, MapSchema, ArraySchema, type } from "@colyseus/schema";
import type { GamePhase } from "@pinbuddys/shared";
import { PlayerState } from "./PlayerState";
import { BallState } from "./BallState";

export class GameState extends Schema {
  /** Current phase of the state machine */
  @type("string") phase: GamePhase = "waiting";

  /** sessionId of the player whose turn it currently is */
  @type("string") currentPlayerId: string = "";

  /** sessionId of the player with a pending bonus throw (empty = none) */
  @type("string") bonusBallHolderId: string = "";

  @type("number") p1Score: number = 0;
  @type("number") p2Score: number = 0;

  /** sessionId of the winner (populated when phase = "gameOver") */
  @type("string") winnerId: string = "";

  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type([BallState]) balls = new ArraySchema<BallState>();
}
