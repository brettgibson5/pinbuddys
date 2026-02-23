import { Component, OnInit, OnDestroy } from "@angular/core";
import { IonContent } from "@ionic/angular/standalone";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { Capacitor } from "@capacitor/core";

/**
 * GamePage is a full-screen shell that hosts the Phaser game.
 * Because Capacitor points its webDir at the client's Vite dist,
 * the Phaser game loads directly as the web content — this page
 * exists only for native hooks (haptics, orientation, deep links).
 *
 * If you want to embed the game inside an Angular shell (e.g. for
 * a native nav bar or side menu), inject an <iframe> or render the
 * Phaser canvas inside a <div> via a script tag here.
 */
@Component({
  selector: "app-game",
  standalone: true,
  imports: [IonContent],
  template: `
    <ion-content [fullscreen]="true" [scrollY]="false">
      <!-- Phaser mounts into #game-container from index.html -->
    </ion-content>
  `,
  styles: [
    `
      ion-content {
        --background: #1a1a2e;
      }
    `,
  ],
})
export class GamePage implements OnInit, OnDestroy {
  async ngOnInit(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      // Listen for custom haptic events dispatched by the Phaser game via
      // window.dispatchEvent(new CustomEvent("haptic", { detail: "throw" }))
      window.addEventListener("haptic", this.handleHaptic);
    }
  }

  ngOnDestroy(): void {
    window.removeEventListener("haptic", this.handleHaptic);
  }

  private handleHaptic = async (event: Event): Promise<void> => {
    const detail = (event as CustomEvent<string>).detail;
    if (detail === "throw" || detail === "score") {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } else if (detail === "capture") {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    }
  };
}
