import { Component, OnInit } from "@angular/core";
import { IonApp, IonRouterOutlet } from "@ionic/angular/standalone";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import { Capacitor } from "@capacitor/core";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [IonApp, IonRouterOutlet],
  template: `<ion-app><ion-router-outlet></ion-router-outlet></ion-app>`,
})
export class AppComponent implements OnInit {
  async ngOnInit(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: "#1a1a2e" });
      await SplashScreen.hide();
    }
  }
}
