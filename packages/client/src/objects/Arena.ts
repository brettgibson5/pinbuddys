import Phaser from "phaser";
import { ARENA } from "@pinbuddys/shared";

/**
 * Draws the arena background, center divider, and scoring-zone highlights.
 * In landscape: endzones are left/right columns.
 * In portrait:  endzones are top/bottom rows (phone held vertically, players at each end).
 */
export class Arena extends Phaser.GameObjects.Container {
  private leftHighlight!: Phaser.GameObjects.Rectangle;
  private rightHighlight!: Phaser.GameObjects.Rectangle;
  // In portrait these become top/bottom highlights
  private topHighlight!: Phaser.GameObjects.Rectangle;
  private bottomHighlight!: Phaser.GameObjects.Rectangle;

  private portrait: boolean;

  constructor(scene: Phaser.Scene, sceneW: number, sceneH: number) {
    super(scene, 0, 0);
    this.portrait = sceneH > sceneW;

    if (this.portrait) {
      this.buildPortrait(sceneW, sceneH);
    } else {
      this.buildLandscape(sceneW, sceneH);
    }

    scene.add.existing(this);
  }

  // ─── Landscape layout (endzones left / right) ───────────────────────────────

  private buildLandscape(w: number, h: number): void {
    const sx = w / ARENA.WIDTH;
    const endW = ARENA.LEFT_ENDZONE_END * sx;

    // Halves background
    this.add([
      this.scene.add.rectangle(w / 4, h / 2, w / 2, h, 0x1a1a3e),
      this.scene.add.rectangle((w * 3) / 4, h / 2, w / 2, h, 0x2a1a2e),
    ]);

    // Scoring highlights (flash on score)
    this.leftHighlight = this.scene.add.rectangle(w / 4, h / 2, w / 2, h, 0x4cc9f0, 0);
    this.rightHighlight = this.scene.add.rectangle((w * 3) / 4, h / 2, w / 2, h, 0xf72585, 0);
    this.add([this.leftHighlight, this.rightHighlight]);

    // Endzone overlays
    const leftZone = this.scene.add.rectangle(0, 0, endW, h, 0x111111, 0.55).setOrigin(0);
    const rightZone = this.scene.add.rectangle(w - endW, 0, endW, h, 0x111111, 0.55).setOrigin(0);
    this.add([leftZone, rightZone]);

    // Dashed endzone boundary lines
    const eLine = this.scene.add.graphics();
    eLine.lineStyle(1, 0xffffff, 0.2);
    for (const x of [endW, w - endW]) {
      this.drawDashedLineV(eLine, x, 0, h, 8, 6);
    }
    this.add(eLine);

    // Dashed center divider
    const cLine = this.scene.add.graphics();
    cLine.lineStyle(2, 0xffffff, 0.3);
    this.drawDashedLineV(cLine, w / 2, 0, h, 12, 8);
    this.add(cLine);
  }

  // ─── Portrait layout (endzones top / bottom) ────────────────────────────────

  private buildPortrait(w: number, h: number): void {
    // In portrait: ARENA.WIDTH maps to the screen height (long axis),
    //              ARENA.HEIGHT maps to the screen width (short axis).
    const sy = h / ARENA.WIDTH;
    const endH = ARENA.LEFT_ENDZONE_END * sy; // endzone depth in screen px

    // Halves background (top = P2, bottom = P1)
    this.add([
      this.scene.add.rectangle(w / 2, h / 4, w, h / 2, 0x2a1a2e),   // top (P2)
      this.scene.add.rectangle(w / 2, (h * 3) / 4, w, h / 2, 0x1a1a3e), // bottom (P1)
    ]);

    // Scoring highlights
    this.topHighlight = this.scene.add.rectangle(w / 2, h / 4, w, h / 2, 0xf72585, 0);
    this.bottomHighlight = this.scene.add.rectangle(w / 2, (h * 3) / 4, w, h / 2, 0x4cc9f0, 0);
    this.add([this.topHighlight, this.bottomHighlight]);
    // Map to left/right names for flashScore API compatibility
    this.leftHighlight = this.bottomHighlight;
    this.rightHighlight = this.topHighlight;

    // Endzone overlays
    const topZone = this.scene.add.rectangle(0, 0, w, endH, 0x111111, 0.55).setOrigin(0);
    const bottomZone = this.scene.add.rectangle(0, h - endH, w, endH, 0x111111, 0.55).setOrigin(0);
    this.add([topZone, bottomZone]);

    // Dashed endzone boundary lines (horizontal)
    const eLine = this.scene.add.graphics();
    eLine.lineStyle(1, 0xffffff, 0.2);
    for (const y of [endH, h - endH]) {
      this.drawDashedLineH(eLine, 0, w, y, 8, 6);
    }
    this.add(eLine);

    // Dashed center divider (horizontal)
    const cLine = this.scene.add.graphics();
    cLine.lineStyle(2, 0xffffff, 0.3);
    this.drawDashedLineH(cLine, 0, w, h / 2, 12, 8);
    this.add(cLine);
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private drawDashedLineV(g: Phaser.GameObjects.Graphics, x: number, y0: number, y1: number, dashLen: number, gap: number): void {
    let y = y0;
    while (y < y1) {
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x, Math.min(y + dashLen, y1));
      g.strokePath();
      y += dashLen + gap;
    }
  }

  private drawDashedLineH(g: Phaser.GameObjects.Graphics, x0: number, x1: number, y: number, dashLen: number, gap: number): void {
    let x = x0;
    while (x < x1) {
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(Math.min(x + dashLen, x1), y);
      g.strokePath();
      x += dashLen + gap;
    }
  }

  /**
   * Flash the scoring zone. In landscape: "left"=P1 half, "right"=P2 half.
   * In portrait:  "left"=P1 bottom half, "right"=P2 top half.
   */
  flashScore(side: "left" | "right"): void {
    const rect = side === "left" ? this.leftHighlight : this.rightHighlight;
    this.scene.tweens.add({
      targets: rect,
      fillAlpha: 0.25,
      duration: 120,
      yoyo: true,
      repeat: 2,
      onComplete: () => rect.setAlpha(0),
    });
  }
}
