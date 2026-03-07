import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { MenuScene } from "./scenes/MenuScene";
import { GameScene } from "./scenes/GameScene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  parent: "game-container",
  backgroundColor: "#1a1a2e",
  render: {
    antialias: true,
    roundPixels: true,
  },
  physics: {
    default: "matter",
    matter: {
      gravity: { x: 0, y: 0 },
      debug: import.meta.env.DEV,
    },
  },
  scene: [BootScene, MenuScene, GameScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
  },
  input: {
    activePointers: 2,
  },
};

const game = new Phaser.Game(config);

// Phaser's Scale.RESIZE mode does not apply devicePixelRatio to the canvas pixel buffer.
// We fix this by going through Phaser's own renderer.resize() path with resolution set to
// the DPR — it correctly sets renderer.width/height to physical pixels (so every camera
// calls gl.viewport at the right size) while passing logical dims to setProjectionMatrix
// (so game coordinates continue to map correctly to the screen).
game.events.once("ready", () => {
  if (game.renderer.type !== Phaser.WEBGL) return;
  const renderer = game.renderer as any;

  const applyDPR = () => {
    const dpr = window.devicePixelRatio || 1;
    if (dpr === 1) return;

    const w = game.scale.width;
    const h = game.scale.height;

    // Inject DPR into the renderer so resize() computes physical pixel dimensions:
    //   renderer.width  = floor(w * resolution) = physical width
    //   renderer.height = floor(h * resolution) = physical height
    //   gl.viewport(0, 0, renderer.width, renderer.height)
    //   setProjectionMatrix(w, h)  ← logical dims → correct HiDPI projection
    renderer.resolution = dpr;
    renderer.resize(w, h);

    // ScaleManager sets canvas CSS size correctly but leaves canvas.width at logical pixels.
    // Expand the pixel buffer to match the physical renderer dimensions.
    game.canvas.width = renderer.width;
    game.canvas.height = renderer.height;
    game.canvas.style.width = w + "px";
    game.canvas.style.height = h + "px";
  };

  applyDPR();
  game.scale.on("resize", applyDPR);

  // Re-apply when the browser moves to a monitor with a different DPR.
  const observeDPR = () => {
    const dpr = window.devicePixelRatio || 1;
    const mq = window.matchMedia(`(resolution: ${dpr}dppx)`);
    mq.addEventListener("change", () => { applyDPR(); observeDPR(); }, { once: true });
  };
  observeDPR();
});
