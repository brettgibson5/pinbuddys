import Phaser from "phaser";
import { Arena } from "../objects/Arena";
import { Ball } from "../objects/Ball";
import { colyseusService } from "../network/ColyseusClient";
import { ARENA, PHYSICS, BALL_PHYSICS, RULES } from "@pinbuddys/shared";
import type {
  BallSize,
  GamePhase,
  ServerEvent,
  ThrowPayload,
} from "@pinbuddys/shared";

// Matter.js (browser build) — used for LOCAL mode physics only
import Matter from "matter-js";

interface SceneData {
  mode: "online" | "local";
  isLocal: boolean;
}

type AimState =
  | { active: false }
  | { active: true; startX: number; startY: number; selectedSize: BallSize };

/** Colyseus ball state shape we care about */
interface RemoteBallState {
  id: string;
  ownerId: string;
  size: BallSize;
  x: number;
  y: number;
  isActive: boolean;
  heldBy: string;
}

export class GameScene extends Phaser.Scene {
  // ─── Layout ────────────────────────────────────────────────────────────────
  private arena!: Arena;
  private sceneW = 0;
  private sceneH = 0;
  // Scale factors arena-units → pixels
  private sx = 1;
  private sy = 1;

  // ─── Mode ──────────────────────────────────────────────────────────────────
  private isLocal = false;
  private mySessionId = "";
  private myPlayerSide: "left" | "right" = "left";

  // ─── Balls ─────────────────────────────────────────────────────────────────
  /** Map from ball id → Ball display object */
  private ballObjects = new Map<string, Ball>();

  // ─── Aiming ────────────────────────────────────────────────────────────────
  private aimState: AimState = { active: false };
  private aimGraphics!: Phaser.GameObjects.Graphics;
  private selectedSize: BallSize = "medium";

  // ─── UI refs ───────────────────────────────────────────────────────────────
  private p1ScoreText!: Phaser.GameObjects.Text;
  private p2ScoreText!: Phaser.GameObjects.Text;
  private turnBannerText!: Phaser.GameObjects.Text;
  private ballSizeBtns: Map<BallSize, Phaser.GameObjects.Container> = new Map();

  // ─── Local mode state ──────────────────────────────────────────────────────
  private localPhase: GamePhase = "p1Turn";
  private localP1Score = 0;
  private localP2Score = 0;
  private localCurrentPlayer: 1 | 2 = 1;
  private localEngine!: Matter.Engine;
  private localBodies = new Map<string, Matter.Body>();
  private localSimInterval: ReturnType<typeof setInterval> | null = null;
  private localRestTicks = 0;
  private localTurnBallId: string | null = null;
  private passScreen!: Phaser.GameObjects.Container;

  constructor() {
    super({ key: "GameScene" });
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  init(data: SceneData): void {
    this.isLocal = data?.isLocal ?? false;
  }

  create(): void {
    this.sceneW = this.scale.width;
    this.sceneH = this.scale.height;
    this.sx = this.sceneW / ARENA.WIDTH;
    this.sy = this.sceneH / ARENA.HEIGHT;

    this.arena = new Arena(this, this.sceneW, this.sceneH);
    this.aimGraphics = this.add.graphics();

    this.buildScoreUI();
    this.buildBallSizeSelector();
    this.buildTurnBanner();
    this.setupInput();

    if (this.isLocal) {
      this.initLocalMode();
    } else {
      this.initOnlineMode();
    }
  }

  update(): void {
    if (this.aimState.active) {
      this.drawAimIndicator();
    }

    // Advance local physics
    if (this.isLocal && this.localPhase === "simulating") {
      this.localStep();
    }

    // Interpolate all ball positions
    for (const ball of this.ballObjects.values()) {
      ball.preUpdate();
    }
  }

  // ─── UI Building ───────────────────────────────────────────────────────────

  private buildScoreUI(): void {
    const pad = 16;
    this.p1ScoreText = this.add
      .text(pad, pad, "P1: 0", {
        fontSize: "22px",
        color: "#4cc9f0",
        fontFamily: "Arial Black",
      })
      .setDepth(10);

    this.p2ScoreText = this.add
      .text(this.sceneW - pad, pad, "P2: 0", {
        fontSize: "22px",
        color: "#f72585",
        fontFamily: "Arial Black",
      })
      .setOrigin(1, 0)
      .setDepth(10);
  }

  private buildTurnBanner(): void {
    this.turnBannerText = this.add
      .text(this.sceneW / 2, 18, "", {
        fontSize: "16px",
        color: "#ffffff",
        fontFamily: "Arial",
        backgroundColor: "#00000066",
        padding: { x: 10, y: 4 },
      })
      .setOrigin(0.5, 0)
      .setDepth(10);
  }

  private buildBallSizeSelector(): void {
    const sizes: BallSize[] = ["small", "medium", "large"];
    const totalW = sizes.length * 64 + (sizes.length - 1) * 12;
    let startX = (this.sceneW - totalW) / 2;
    const baseY = this.sceneH - 50;

    for (const size of sizes) {
      const radius = BALL_PHYSICS[size].radius * 0.7;
      const isSelected = size === this.selectedSize;

      const bg = this.add
        .circle(
          0,
          0,
          radius + 8,
          isSelected ? 0xffffff : 0x444466,
          isSelected ? 0.3 : 0.15,
        )
        .setStrokeStyle(2, 0xffffff, 0.5)
        .setInteractive({ useHandCursor: true });

      const dot = this.add.arc(0, 0, radius, 0, 360, false, 0x888899);

      const label = size[0].toUpperCase(); // S / M / L
      const labelText = this.add
        .text(0, radius + 14, label, {
          fontSize: "12px",
          color: "#aaaacc",
          fontFamily: "Arial",
        })
        .setOrigin(0.5);

      const container = this.add.container(startX + radius + 8, baseY, [
        bg,
        dot,
        labelText,
      ]);
      container.setDepth(10);

      bg.on("pointerdown", () => this.selectBallSize(size));

      this.ballSizeBtns.set(size, container);
      startX += radius * 2 + 12 + 16;
    }
  }

  private selectBallSize(size: BallSize): void {
    this.selectedSize = size;
    // Visual feedback — update button highlights
    for (const [s, container] of this.ballSizeBtns) {
      const bg = container.list[0] as Phaser.GameObjects.Arc;
      bg.setFillStyle(0xffffff, s === size ? 0.3 : 0.15);
    }
    if (!this.isLocal) {
      colyseusService.sendSelectBall({ size });
    }
  }

  // ─── Input ─────────────────────────────────────────────────────────────────

  private setupInput(): void {
    this.input.on("pointerdown", (ptr: Phaser.Input.Pointer) => {
      if (!this.isMyTurn()) return;
      this.aimState = {
        active: true,
        startX: ptr.x,
        startY: ptr.y,
        selectedSize: this.selectedSize,
      };
    });

    this.input.on("pointerup", (ptr: Phaser.Input.Pointer) => {
      if (!this.aimState.active) return;
      const { startX, startY } = this.aimState;
      this.aimState = { active: false };
      this.aimGraphics.clear();

      const dx = ptr.x - startX;
      const dy = ptr.y - startY;
      const dist = Math.hypot(dx, dy);
      if (dist < 10) return; // too short a drag

      // Angle: direction the ball travels = opposite of drag direction
      const angle = Math.atan2(-dy, -dx);
      const power = Math.min(dist / 150, 1);

      this.performThrow(angle, power);
    });
  }

  private isMyTurn(): boolean {
    if (this.isLocal) {
      return this.localPhase === "p1Turn" || this.localPhase === "p2Turn";
    }
    const room = colyseusService.getRoom();
    if (!room) return false;
    return room.state.currentPlayerId === room.sessionId;
  }

  private performThrow(angle: number, power: number): void {
    const payload: ThrowPayload = { size: this.selectedSize, angle, power };
    if (this.isLocal) {
      this.localHandleThrow(payload);
    } else {
      colyseusService.sendThrow(payload);
    }
  }

  // ─── Aim Drawing ───────────────────────────────────────────────────────────

  private drawAimIndicator(): void {
    if (!this.aimState.active) return;
    this.aimGraphics.clear();

    const ptr = this.input.activePointer;
    const { startX, startY } = this.aimState;
    const dx = ptr.x - startX;
    const dy = ptr.y - startY;

    // Arrow from start to pointer
    this.aimGraphics.lineStyle(2, 0xffffff, 0.5);
    this.aimGraphics.beginPath();
    this.aimGraphics.moveTo(startX, startY);
    this.aimGraphics.lineTo(ptr.x, ptr.y);
    this.aimGraphics.strokePath();

    // Dotted projected path (simple linear preview, not physics)
    const angle = Math.atan2(-dy, -dx);
    const dist = Math.min(Math.hypot(dx, dy), 150);
    this.aimGraphics.lineStyle(1, 0xffffff, 0.25);
    const steps = 8;
    for (let i = 0; i < steps; i++) {
      const t0 = (i / steps) * dist * 1.5;
      const t1 = ((i + 0.5) / steps) * dist * 1.5;
      this.aimGraphics.beginPath();
      this.aimGraphics.moveTo(
        startX + Math.cos(angle) * t0,
        startY + Math.sin(angle) * t0,
      );
      this.aimGraphics.lineTo(
        startX + Math.cos(angle) * t1,
        startY + Math.sin(angle) * t1,
      );
      this.aimGraphics.strokePath();
    }
  }

  // ─── Online Mode ───────────────────────────────────────────────────────────

  private initOnlineMode(): void {
    const room = colyseusService.getRoom();
    if (!room) {
      console.error("[GameScene] No active room — returning to menu");
      this.scene.start("MenuScene");
      return;
    }

    this.mySessionId = room.sessionId;

    // Listen to state changes
    room.state.onChange(() => {
      this.syncScoreUI(room.state.p1Score, room.state.p2Score);
      this.updateTurnBanner(room.state.currentPlayerId, room.state.phase);
    });

    room.state.balls.onAdd((ball: RemoteBallState) => {
      this.onBallAdded(ball);
    });
    room.state.balls.onChange((ball: RemoteBallState) => {
      this.onBallChanged(ball);
    });
    room.state.balls.onRemove((ball: RemoteBallState) => {
      this.ballObjects.get(ball.id)?.destroy();
      this.ballObjects.delete(ball.id);
    });

    // Server events
    colyseusService.on("scored", (e) => {
      const side: "left" | "right" =
        e.scorerId === this.getLeftPlayerId(room) ? "right" : "left";
      this.arena.flashScore(side);
      this.showToast("SCORED! +1");
    });

    colyseusService.on("ballCaptured", () => this.showToast("Ball captured!"));
    colyseusService.on("bonusThrow", (e) => {
      if (e.playerId === this.mySessionId) this.showToast("Bonus throw!");
    });

    colyseusService.on("gameOver", (e) => {
      const won = e.winnerId === this.mySessionId;
      this.showGameOver(won, e.finalScore);
    });

    colyseusService.on("opponentDisconnected", () =>
      this.showToast("Opponent disconnected…"),
    );

    // Determine our side
    const player = room.state.players.get(this.mySessionId);
    if (player) this.myPlayerSide = player.side as "left" | "right";
  }

  private getLeftPlayerId(
    room: ReturnType<typeof colyseusService.getRoom>,
  ): string {
    for (const [id, player] of room!.state.players) {
      if (player.side === "left") return id;
    }
    return "";
  }

  private onBallAdded(ball: RemoteBallState): void {
    if (!ball.isActive) return;
    const owner = colyseusService.getRoom()?.state.players.get(ball.ownerId);
    const isLeft = owner?.side === "left";
    const b = new Ball(
      this,
      ball.x * this.sx,
      ball.y * this.sy,
      ball.size,
      ball.id,
      isLeft,
    );
    this.ballObjects.set(ball.id, b);
  }

  private onBallChanged(ball: RemoteBallState): void {
    if (!ball.isActive) {
      const obj = this.ballObjects.get(ball.id);
      if (obj) {
        obj.playScoreAnimation();
        this.ballObjects.delete(ball.id);
      }
      return;
    }
    const obj = this.ballObjects.get(ball.id);
    if (obj) {
      obj.syncFromState(ball.x * this.sx, ball.y * this.sy);
    }
  }

  private syncScoreUI(p1: number, p2: number): void {
    this.p1ScoreText.setText(`P1: ${p1}`);
    this.p2ScoreText.setText(`P2: ${p2}`);
  }

  private updateTurnBanner(currentPlayerId: string, phase: GamePhase): void {
    const isMyTurn = currentPlayerId === this.mySessionId;
    if (phase === "simulating") {
      this.turnBannerText.setText("…rolling");
    } else if (phase === "gameOver") {
      this.turnBannerText.setText("Game Over");
    } else if (isMyTurn) {
      this.turnBannerText.setText("Your turn — drag to throw");
    } else {
      this.turnBannerText.setText("Opponent's turn");
    }
  }

  // ─── Local Mode ────────────────────────────────────────────────────────────

  private initLocalMode(): void {
    this.localEngine = Matter.Engine.create({
      gravity: { x: 0, y: PHYSICS.GRAVITY_SCALE },
    });

    // Build walls
    const W = ARENA.WIDTH * this.sx;
    const H = ARENA.HEIGHT * this.sy;
    const T = ARENA.WALL_THICKNESS;
    Matter.Composite.add(this.localEngine.world, [
      Matter.Bodies.rectangle(W / 2, -T / 2, W, T, { isStatic: true }),
      Matter.Bodies.rectangle(W / 2, H + T / 2, W, T, { isStatic: true }),
      Matter.Bodies.rectangle(-T / 2, H / 2, T, H, { isStatic: true }),
      Matter.Bodies.rectangle(W + T / 2, H / 2, T, H, { isStatic: true }),
    ]);

    this.localPhase = "p1Turn";
    this.updateLocalBanner();
    this.buildPassScreen();
  }

  private buildPassScreen(): void {
    const { width, height } = this.scale;
    const bg = this.add
      .rectangle(0, 0, width, height, 0x000000, 0.85)
      .setOrigin(0);
    const msg = this.add
      .text(width / 2, height / 2 - 20, "", {
        fontSize: "24px",
        color: "#ffffff",
        fontFamily: "Arial",
        align: "center",
      })
      .setOrigin(0.5);
    const hint = this.add
      .text(width / 2, height / 2 + 30, "Tap to continue", {
        fontSize: "16px",
        color: "#aaaacc",
        fontFamily: "Arial",
      })
      .setOrigin(0.5);

    this.passScreen = this.add
      .container(0, 0, [bg, msg, hint])
      .setDepth(50)
      .setVisible(false);

    bg.setInteractive();
    bg.on("pointerdown", () => {
      this.passScreen.setVisible(false);
      this.updateLocalBanner();
    });
  }

  private showPassScreen(): void {
    const player = this.localCurrentPlayer === 1 ? "Player 2" : "Player 1";
    const msg = this.passScreen.list[1] as Phaser.GameObjects.Text;
    msg.setText(`Pass to ${player}`);
    this.passScreen.setVisible(true);
  }

  private localHandleThrow(payload: ThrowPayload): void {
    if (this.localPhase !== "p1Turn" && this.localPhase !== "p2Turn") return;

    // Spawn ball in local physics
    const ballId = `local_${Date.now()}`;
    const isLeft = this.localCurrentPlayer === 1;
    const startX = isLeft
      ? ARENA.WIDTH * 0.25 * this.sx
      : ARENA.WIDTH * 0.75 * this.sx;
    const startY = (ARENA.HEIGHT / 2) * this.sy;

    const consts = BALL_PHYSICS[payload.size];
    const scaledRadius = consts.radius * Math.min(this.sx, this.sy);

    const body = Matter.Bodies.circle(startX, startY, scaledRadius, {
      mass: consts.mass,
      frictionAir: consts.frictionAir,
      restitution: consts.restitution,
      friction: consts.friction,
      frictionStatic: consts.frictionStatic,
    });

    const forceMag =
      (PHYSICS.MIN_THROW_FORCE +
        payload.power * (PHYSICS.MAX_THROW_FORCE - PHYSICS.MIN_THROW_FORCE)) *
      consts.mass *
      this.sx;

    Matter.Body.setVelocity(body, {
      x: Math.cos(payload.angle) * forceMag,
      y: Math.sin(payload.angle) * forceMag,
    });

    Matter.Composite.add(this.localEngine.world, body);
    this.localBodies.set(ballId, body);
    this.localTurnBallId = ballId;
    this.localRestTicks = 0;

    // Create visual ball
    const ball = new Ball(this, startX, startY, payload.size, ballId, isLeft);
    this.ballObjects.set(ballId, ball);

    this.localPhase = "simulating";
  }

  private localStep(): void {
    Matter.Engine.update(this.localEngine, PHYSICS.DELTA_MS);

    // Sync visuals
    for (const [id, body] of this.localBodies) {
      const obj = this.ballObjects.get(id);
      if (obj) obj.syncFromState(body.position.x, body.position.y);
    }

    if (!this.localTurnBallId) return;

    const body = this.localBodies.get(this.localTurnBallId);
    if (!body) return;

    // Check OOB
    const W = ARENA.WIDTH * this.sx;
    if (body.position.x < 0 || body.position.x > W) {
      this.localEvaluateCaptured();
      return;
    }

    // Check rest
    const speed = Math.hypot(body.velocity.x, body.velocity.y);
    if (speed < PHYSICS.REST_SPEED_THRESHOLD) {
      this.localRestTicks++;
      if (this.localRestTicks >= PHYSICS.REST_TICKS_REQUIRED) {
        this.localEvaluateScoring();
      }
    } else {
      this.localRestTicks = 0;
    }
  }

  private localEvaluateScoring(): void {
    this.localPhase = "roundEval";
    if (!this.localTurnBallId) return;

    const body = this.localBodies.get(this.localTurnBallId)!;
    const halfW = (ARENA.WIDTH / 2) * this.sx;
    const isOnOpponentHalf =
      this.localCurrentPlayer === 1
        ? body.position.x > halfW + ARENA.SCORE_BUFFER * this.sx
        : body.position.x < halfW - ARENA.SCORE_BUFFER * this.sx;

    if (isOnOpponentHalf) {
      if (this.localCurrentPlayer === 1) this.localP1Score++;
      else this.localP2Score++;
      this.p1ScoreText.setText(`P1: ${this.localP1Score}`);
      this.p2ScoreText.setText(`P2: ${this.localP2Score}`);
      this.showToast("SCORED! +1");
      this.arena.flashScore(this.localCurrentPlayer === 1 ? "right" : "left");
    }

    this.cleanupLocalBall();

    // Check win condition before advancing turn
    if (
      this.localP1Score >= RULES.WIN_SCORE ||
      this.localP2Score >= RULES.WIN_SCORE
    ) {
      const winner = this.localP1Score >= RULES.WIN_SCORE ? 1 : 2;
      this.showLocalGameOver(winner, {
        p1: this.localP1Score,
        p2: this.localP2Score,
      });
      return;
    }

    this.localAdvanceTurn();
  }

  private localEvaluateCaptured(): void {
    this.localPhase = "roundEval";
    const ballId = this.localTurnBallId;
    if (!ballId) return;

    this.cleanupLocalBall();
    const capturingPlayer = this.localCurrentPlayer === 1 ? 2 : 1;
    this.showToast(`Player ${capturingPlayer} captured the ball!`);

    // Bonus turn for capturing player — just swap and let them throw again
    this.localCurrentPlayer = capturingPlayer as 1 | 2;
    this.localPhase = this.localCurrentPlayer === 1 ? "p1Turn" : "p2Turn";
    this.showPassScreen();
  }

  private cleanupLocalBall(): void {
    if (!this.localTurnBallId) return;
    const body = this.localBodies.get(this.localTurnBallId);
    if (body) Matter.Composite.remove(this.localEngine.world, body);
    this.localBodies.delete(this.localTurnBallId);

    const obj = this.ballObjects.get(this.localTurnBallId);
    if (obj) {
      obj.playScoreAnimation();
      this.ballObjects.delete(this.localTurnBallId);
    }

    this.localTurnBallId = null;
  }

  private localAdvanceTurn(): void {
    this.localCurrentPlayer = this.localCurrentPlayer === 1 ? 2 : 1;
    this.localPhase = this.localCurrentPlayer === 1 ? "p1Turn" : "p2Turn";
    this.showPassScreen();
  }

  private showLocalGameOver(
    winner: 1 | 2,
    score: { p1: number; p2: number },
  ): void {
    const overlay = this.add
      .rectangle(
        this.sceneW / 2,
        this.sceneH / 2,
        this.sceneW,
        this.sceneH,
        0x000000,
        0.7,
      )
      .setDepth(30);
    void overlay; // suppress unused warning

    const color = winner === 1 ? "#4cc9f0" : "#f72585";
    this.add
      .text(
        this.sceneW / 2,
        this.sceneH / 2 - 40,
        `Player ${winner} Wins! 🎉`,
        {
          fontSize: "36px",
          color,
          fontFamily: "Arial Black",
          stroke: "#000000",
          strokeThickness: 4,
        },
      )
      .setOrigin(0.5)
      .setDepth(31);

    this.add
      .text(
        this.sceneW / 2,
        this.sceneH / 2 + 20,
        `Final score — P1: ${score.p1}  P2: ${score.p2}`,
        { fontSize: "18px", color: "#ffffff", fontFamily: "Arial" },
      )
      .setOrigin(0.5)
      .setDepth(31);

    this.add
      .text(this.sceneW / 2, this.sceneH / 2 + 80, "Back to Menu", {
        fontSize: "20px",
        color: "#aaddff",
        fontFamily: "Arial",
        backgroundColor: "#ffffff22",
        padding: { x: 14, y: 8 },
      })
      .setOrigin(0.5)
      .setDepth(31)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.scene.start("MenuScene"));
  }

  private updateLocalBanner(): void {
    this.turnBannerText.setText(
      `Player ${this.localCurrentPlayer}'s turn — drag to throw`,
    );
    this.p1ScoreText.setColor(
      this.localCurrentPlayer === 1 ? "#ffffff" : "#4cc9f0",
    );
    this.p2ScoreText.setColor(
      this.localCurrentPlayer === 2 ? "#ffffff" : "#f72585",
    );
  }

  // ─── Toast / Game Over ─────────────────────────────────────────────────────

  private showToast(msg: string): void {
    const t = this.add
      .text(this.sceneW / 2, this.sceneH * 0.4, msg, {
        fontSize: "20px",
        color: "#ffffff",
        fontFamily: "Arial Black",
        stroke: "#000000",
        strokeThickness: 4,
        backgroundColor: "#00000055",
        padding: { x: 12, y: 6 },
      })
      .setOrigin(0.5)
      .setDepth(20);

    this.tweens.add({
      targets: t,
      y: t.y - 50,
      alpha: 0,
      duration: 1600,
      ease: "Power2",
      onComplete: () => t.destroy(),
    });
  }

  private showGameOver(won: boolean, score: { p1: number; p2: number }): void {
    const overlay = this.add
      .rectangle(
        this.sceneW / 2,
        this.sceneH / 2,
        this.sceneW,
        this.sceneH,
        0x000000,
        0.7,
      )
      .setDepth(30);

    this.add
      .text(
        this.sceneW / 2,
        this.sceneH / 2 - 40,
        won ? "You Win! 🎉" : "You Lose",
        {
          fontSize: "36px",
          color: won ? "#4cc9f0" : "#f72585",
          fontFamily: "Arial Black",
          stroke: "#000000",
          strokeThickness: 4,
        },
      )
      .setOrigin(0.5)
      .setDepth(31);

    this.add
      .text(
        this.sceneW / 2,
        this.sceneH / 2 + 20,
        `Final score — P1: ${score.p1}  P2: ${score.p2}`,
        {
          fontSize: "18px",
          color: "#ffffff",
          fontFamily: "Arial",
        },
      )
      .setOrigin(0.5)
      .setDepth(31);

    const menuBtn = this.add
      .text(this.sceneW / 2, this.sceneH / 2 + 80, "Back to Menu", {
        fontSize: "20px",
        color: "#aaddff",
        fontFamily: "Arial",
        backgroundColor: "#ffffff22",
        padding: { x: 14, y: 8 },
      })
      .setOrigin(0.5)
      .setDepth(31)
      .setInteractive({ useHandCursor: true });

    menuBtn.on("pointerdown", () => {
      colyseusService.leave();
      this.scene.start("MenuScene");
    });
  }
}
