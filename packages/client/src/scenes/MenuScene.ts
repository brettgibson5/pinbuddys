import Phaser from "phaser";
import { getTopPlayers } from "../firebase/firebaseClient";
import { colyseusService } from "../network/ColyseusClient";
import { getCurrentUser } from "../firebase/firebaseClient";

/**
 * Main menu: Play Online, Local Pass-and-Play, Leaderboard.
 */
export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: "MenuScene" });
  }

  create(): void {
    const { width, height } = this.scale;
    const cx = width / 2;

    // Title
    this.add
      .text(cx, height * 0.18, "PinBuddys", {
        fontSize: "48px",
        color: "#4cc9f0",
        fontFamily: "Arial Black, Arial",
        stroke: "#000000",
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    this.add
      .text(cx, height * 0.3, "🎱 Roll. Score. Win.", {
        fontSize: "18px",
        color: "#aaaacc",
        fontFamily: "Arial",
      })
      .setOrigin(0.5);

    const buttons: Array<{ label: string; y: number; action: () => void }> = [
      { label: "Play Online", y: height * 0.45, action: () => this.startOnline() },
      { label: "Local Pass & Play", y: height * 0.57, action: () => this.startLocal() },
      { label: "Join by Code", y: height * 0.69, action: () => this.joinByCode() },
      { label: "Leaderboard", y: height * 0.81, action: () => this.showLeaderboard() },
    ];

    for (const btn of buttons) {
      this.makeButton(cx, btn.y, btn.label, btn.action);
    }
  }

  private makeButton(x: number, y: number, label: string, onClick: () => void): void {
    const bg = this.add
      .rectangle(x, y, 220, 44, 0x4cc9f0, 0.15)
      .setStrokeStyle(2, 0x4cc9f0, 0.8)
      .setInteractive({ useHandCursor: true });

    const text = this.add
      .text(x, y, label, {
        fontSize: "18px",
        color: "#ffffff",
        fontFamily: "Arial",
      })
      .setOrigin(0.5);

    bg.on("pointerover", () => bg.setFillStyle(0x4cc9f0, 0.35));
    bg.on("pointerout", () => bg.setFillStyle(0x4cc9f0, 0.15));
    bg.on("pointerdown", onClick);
  }

  private async startOnline(): Promise<void> {
    const user = getCurrentUser();
    try {
      await colyseusService.matchmake({
        displayName: user?.displayName ?? "Player",
        firebaseUid: user?.uid ?? "",
      });
      this.scene.start("GameScene", { mode: "online", isLocal: false });
    } catch (err) {
      console.error("[Menu] Matchmaking failed:", err);
      this.showError("Could not connect to server. Is it running?");
    }
  }

  private startLocal(): void {
    this.scene.start("GameScene", { mode: "local", isLocal: true });
  }

  private async joinByCode(): Promise<void> {
    // Simple prompt fallback — replace with a proper in-game dialog
    const code = window.prompt("Enter room code:");
    if (!code) return;
    const user = getCurrentUser();
    try {
      await colyseusService.joinRoom(code.trim(), {
        displayName: user?.displayName ?? "Player",
        firebaseUid: user?.uid ?? "",
      });
      this.scene.start("GameScene", { mode: "online", isLocal: false });
    } catch (err) {
      console.error("[Menu] Join by code failed:", err);
      this.showError("Room not found. Check the code and try again.");
    }
  }

  private async showLeaderboard(): Promise<void> {
    try {
      const players = await getTopPlayers(10);
      let text = "── Top Players ──\n\n";
      players.forEach((p, i) => {
        text += `${i + 1}. ${p.displayName}  ${p.wins}W / ${p.losses}L\n`;
      });
      window.alert(text);
    } catch {
      window.alert("Leaderboard unavailable (Firebase not configured).");
    }
  }

  private showError(msg: string): void {
    const { width, height } = this.scale;
    const t = this.add
      .text(width / 2, height * 0.92, msg, {
        fontSize: "14px",
        color: "#ff6b6b",
        fontFamily: "Arial",
      })
      .setOrigin(0.5);
    this.time.delayedCall(3000, () => t.destroy());
  }
}
