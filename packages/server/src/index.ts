import "dotenv/config";
import http from "http";
import express from "express";
import cors from "cors";
import { Server } from "colyseus";
import { monitor } from "@colyseus/monitor";
import { BumpBuddiesRoom } from "./rooms/BumpBuddiesRoom";
import { ROOM_NAME } from "@bumpbuddies/shared";

const PORT = Number(process.env.PORT ?? 2567);

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = http.createServer(app);

const gameServer = new Server({ server: httpServer });

// Register the main game room
gameServer.define(ROOM_NAME, BumpBuddiesRoom).enableRealtimeListing();

// Colyseus admin monitor (development only)
if (process.env.NODE_ENV !== "production") {
  app.use("/colyseus", monitor());
}

app.get("/health", (_req, res) => res.json({ status: "ok" }));

gameServer.listen(PORT).then(() => {
  console.log(`\n[Bump Buddies Server] Listening on ws://localhost:${PORT}`);
  if (process.env.NODE_ENV !== "production") {
    console.log(`[Bump Buddies Server] Monitor → http://localhost:${PORT}/colyseus`);
  }
});
