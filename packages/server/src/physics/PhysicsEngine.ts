import Matter from "matter-js";
import { ARENA, PHYSICS, BALL_PHYSICS } from "@pinbuddys/shared";
import type { BallSize, ThrowPayload } from "@pinbuddys/shared";

const { Engine, World, Bodies, Body, Events } = Matter;

export interface BallSnapshot {
  id: string;
  x: number;
  y: number;
  velX: number;
  velY: number;
}

export interface ThrowResult {
  /** Where the ball finally came to rest */
  finalX: number;
  finalY: number;
  /**
   * "scored"   — ball is fully on opponent's half and at rest
   * "captured" — ball exited the far boundary
   * "returned" — ball ended up back on thrower's own half
   * "blocked"  — knocked back by a collision and went back
   */
  outcome: "scored" | "captured" | "returned" | "blocked";
}

/**
 * Server-side Matter.js wrapper.
 * Runs a headless physics world used by PinBuddysRoom.
 * All coordinates are in ARENA units (800×480).
 */
export class PhysicsEngine {
  private engine: Matter.Engine;
  private world: Matter.World;
  /** Map from ball id → Matter body */
  private bodies = new Map<string, Matter.Body>();

  constructor() {
    this.engine = Engine.create({
      gravity: { x: 0, y: PHYSICS.GRAVITY_SCALE },
    });
    this.world = this.engine.world;
    this.buildArena();
  }

  // ─── Setup ─────────────────────────────────────────────────────────────────

  private buildArena(): void {
    const W = ARENA.WIDTH;
    const H = ARENA.HEIGHT;
    const T = ARENA.WALL_THICKNESS;

    // Top wall, bottom wall, left wall, right wall (static bodies)
    const walls = [
      Bodies.rectangle(W / 2, -T / 2, W, T, { isStatic: true, label: "wallTop" }),
      Bodies.rectangle(W / 2, H + T / 2, W, T, { isStatic: true, label: "wallBottom" }),
      Bodies.rectangle(-T / 2, H / 2, T, H, { isStatic: true, label: "wallLeft" }),
      Bodies.rectangle(W + T / 2, H / 2, T, H, { isStatic: true, label: "wallRight" }),
    ];
    World.add(this.world, walls);
  }

  // ─── Ball management ───────────────────────────────────────────────────────

  addBall(id: string, size: BallSize, x: number, y: number): void {
    const consts = BALL_PHYSICS[size];
    const body = Bodies.circle(x, y, consts.radius, {
      mass: consts.mass,
      frictionAir: consts.frictionAir,
      restitution: consts.restitution,
      friction: consts.friction,
      frictionStatic: consts.frictionStatic,
      label: id,
    });
    this.bodies.set(id, body);
    World.add(this.world, body);
  }

  removeBall(id: string): void {
    const body = this.bodies.get(id);
    if (body) {
      World.remove(this.world, body);
      this.bodies.delete(id);
    }
  }

  /**
   * Apply a throw impulse to an existing ball body.
   * `payload.angle` is in radians (0 = right, positive = clockwise).
   * `payload.power` is 0–1 normalised.
   */
  applyThrow(ballId: string, payload: ThrowPayload): void {
    const body = this.bodies.get(ballId);
    if (!body) return;

    const consts = BALL_PHYSICS[payload.size];
    const forceMag =
      (PHYSICS.MIN_THROW_FORCE +
        payload.power * (PHYSICS.MAX_THROW_FORCE - PHYSICS.MIN_THROW_FORCE)) *
      consts.mass;

    Body.setVelocity(body, {
      x: Math.cos(payload.angle) * forceMag,
      y: Math.sin(payload.angle) * forceMag,
    });
  }

  // ─── Simulation ────────────────────────────────────────────────────────────

  /**
   * Advance the simulation by one tick (1/60 s).
   * Returns current snapshots of all tracked balls.
   */
  step(): BallSnapshot[] {
    Engine.update(this.engine, PHYSICS.DELTA_MS);
    return this.snapshots();
  }

  snapshots(): BallSnapshot[] {
    const result: BallSnapshot[] = [];
    for (const [id, body] of this.bodies) {
      result.push({
        id,
        x: body.position.x,
        y: body.position.y,
        velX: body.velocity.x,
        velY: body.velocity.y,
      });
    }
    return result;
  }

  isBallAtRest(id: string): boolean {
    const body = this.bodies.get(id);
    if (!body) return true;
    const speed = Math.hypot(body.velocity.x, body.velocity.y);
    return speed < PHYSICS.REST_SPEED_THRESHOLD;
  }

  getBallPosition(id: string): { x: number; y: number } | null {
    const body = this.bodies.get(id);
    if (!body) return null;
    return { x: body.position.x, y: body.position.y };
  }

  isBallOutOfBounds(id: string): { oob: boolean; side: "left" | "right" | null } {
    const body = this.bodies.get(id);
    if (!body) return { oob: false, side: null };
    if (body.position.x < ARENA.LEFT_BOUNDARY) return { oob: true, side: "left" };
    if (body.position.x > ARENA.RIGHT_BOUNDARY) return { oob: true, side: "right" };
    return { oob: false, side: null };
  }

  /** Determine which half a ball is on once at rest */
  getBallHalf(id: string): "left" | "right" | "center" | null {
    const pos = this.getBallPosition(id);
    if (!pos) return null;
    if (pos.x < ARENA.CENTER_X - ARENA.SCORE_BUFFER) return "left";
    if (pos.x > ARENA.CENTER_X + ARENA.SCORE_BUFFER) return "right";
    return "center";
  }

  reset(): void {
    World.clear(this.world, false);
    Engine.clear(this.engine);
    this.bodies.clear();
    this.buildArena();
  }
}
