import { Schema, type } from "@colyseus/schema";
import type { PlayerSide } from "@bumpbuddies/shared";

export class PlayerState extends Schema {
  @type("string") sessionId: string = "";
  @type("string") displayName: string = "Player";
  @type("string") firebaseUid: string = "";
  @type("boolean") connected: boolean = true;
  @type("boolean") ready: boolean = false;
  /** "left" | "right" */
  @type("string") side: PlayerSide = "left";
}
