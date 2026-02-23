import * as Colyseus from "colyseus.js";
import { ROOM_NAME } from "@pinbuddys/shared";
import type {
  ThrowPayload,
  SelectBallPayload,
  ServerEvent,
} from "@pinbuddys/shared";

export type RoomState = Colyseus.Room["state"];

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "ws://localhost:2567";
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 1500;

/**
 * Singleton wrapper around the Colyseus Client.
 * Handles connection, reconnection, and message routing.
 */
class ColyseusClientService {
  private client: Colyseus.Client;
  private room: Colyseus.Room | null = null;
  private eventListeners = new Map<
    ServerEvent["type"],
    Set<(e: ServerEvent) => void>
  >();

  constructor() {
    this.client = new Colyseus.Client(SERVER_URL);
  }

  // ─── Room management ───────────────────────────────────────────────────────

  async createRoom(options: JoinOptions): Promise<Colyseus.Room> {
    this.room = await this.client.create(ROOM_NAME, options);
    this.attachRoomListeners();
    return this.room;
  }

  async joinRoom(roomId: string, options: JoinOptions): Promise<Colyseus.Room> {
    this.room = await this.client.joinById(roomId, options);
    this.attachRoomListeners();
    return this.room;
  }

  async matchmake(options: JoinOptions): Promise<Colyseus.Room> {
    this.room = await this.client.joinOrCreate(ROOM_NAME, options);
    this.attachRoomListeners();
    return this.room;
  }

  async reconnect(reconnectionToken: string): Promise<Colyseus.Room> {
    this.room = await this.client.reconnect(reconnectionToken);
    this.attachRoomListeners();
    return this.room;
  }

  leave(): void {
    this.room?.leave();
    this.room = null;
  }

  getRoom(): Colyseus.Room | null {
    return this.room;
  }

  // ─── Messages ──────────────────────────────────────────────────────────────

  sendThrow(payload: ThrowPayload): void {
    this.room?.send("throw", payload);
  }

  sendSelectBall(payload: SelectBallPayload): void {
    this.room?.send("selectBall", payload);
  }

  // ─── Event listener API ────────────────────────────────────────────────────

  on<T extends ServerEvent["type"]>(
    type: T,
    callback: (e: Extract<ServerEvent, { type: T }>) => void,
  ): () => void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set());
    }
    const cb = callback as (e: ServerEvent) => void;
    this.eventListeners.get(type)!.add(cb);
    return () => this.eventListeners.get(type)?.delete(cb);
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  private attachRoomListeners(): void {
    if (!this.room) return;

    this.room.onMessage("*", (type, message: unknown) => {
      if (typeof type !== "string") return;
      const listeners = this.eventListeners.get(type as ServerEvent["type"]);
      if (listeners) {
        for (const cb of listeners) cb(message as ServerEvent);
      }
    });

    this.room.onLeave((code) => {
      console.log(`[Colyseus] Left room (code ${code})`);
      if (code > 1000) {
        this.attemptReconnect();
      }
    });

    this.room.onError((code, message) => {
      console.error(`[Colyseus] Room error ${code}:`, message);
    });
  }

  private async attemptReconnect(): Promise<void> {
    if (!this.room) return;
    const reconnectionToken = this.room.reconnectionToken;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      await delay(RETRY_DELAY_MS * attempt);
      try {
        await this.reconnect(reconnectionToken);
        console.log("[Colyseus] Reconnected");
        return;
      } catch {
        console.warn(`[Colyseus] Reconnect attempt ${attempt} failed`);
      }
    }
    console.error("[Colyseus] Reconnect gave up");
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface JoinOptions {
  displayName?: string;
  firebaseUid?: string;
}

export const colyseusService = new ColyseusClientService();
