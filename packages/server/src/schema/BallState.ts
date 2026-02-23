import { Schema, type } from "@colyseus/schema";
import type { BallSize } from "@pinbuddys/shared";

export class BallState extends Schema {
  @type("string") id: string = "";
  @type("string") ownerId: string = "";
  /** "small" | "medium" | "large" — stored as plain string for Colyseus */
  @type("string") size: BallSize = "medium";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") velX: number = 0;
  @type("number") velY: number = 0;
  /** Whether this ball is currently on the arena (not captured, not pending) */
  @type("boolean") isActive: boolean = false;
  /**
   * If non-empty, this ball was captured after going out of bounds and is
   * being held by this player for a bonus throw.
   */
  @type("string") heldBy: string = "";
}
