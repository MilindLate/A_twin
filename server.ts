import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import { EngineSimulator } from "./src/server/engine_simulator";
import { DigitalTwin } from "./src/server/digital_twin";

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  app.use(cors());
  app.use(express.json());

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // Services
  const simulator = new EngineSimulator();
  const digitalTwin = new DigitalTwin();

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/fault/inject", (req, res) => {
    const { fault, severity } = req.body;
    simulator.injectFault(fault, severity);
    res.json({ status: "fault injected", fault, severity });
  });

  app.post("/api/fault/clear", (req, res) => {
    simulator.clearFaults();
    res.json({ status: "faults cleared" });
  });

  app.post("/api/mission/profile", (req, res) => {
    const { profile } = req.body;
    simulator.setMissionProfile(profile);
    res.json({ status: "mission profile updated", profile: simulator.getMissionProfile() });
  });

  // Socket.IO for real-time telemetry stream
  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);
    
    // Send initial state if needed
    
    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  // 10 Hz Telemetry Loop
  setInterval(() => {
    // 1. Generate Synthetic Telemetry
    const telemetry = simulator.tick();
    
    // 2. Evaluate in Digital Twin
    const dtResult = digitalTwin.evaluate(telemetry);
    
    // 3. Emit to all connected clients
    io.emit("telemetry", telemetry);
    io.emit("dt_state", dtResult);
    
  }, 100); // 100ms = 10Hz

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
