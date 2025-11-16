import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";

import path from "path";

import { connectDB } from "./lib/db.js";

import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import healthRoutes from "./routes/health.route.js";
console.log("Starting server...");
import { app, server } from "./lib/socket.js";

// Load environment variables from .env file
dotenv.config();

const PORT = process.env.PORT || 5001;
console.log("PORT:", PORT);
const __dirname = path.resolve();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cookieParser());
app.use(
  cors({
    origin: ["https://swift-chat-frontend.vercel.app", "http://localhost:5173", "http://localhost:8080", "http://localhost","https://swiftchat-frontend-eb3s.onrender.com"],
    credentials: true,
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/health", healthRoutes);

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));

  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
  });
}

server.listen(PORT, () => {
  console.log("server is running on PORT:" + PORT);
  connectDB().then(() => {
    console.log("Database connected successfully");
  }).catch((err) => {
    console.error("Database connection failed:", err);
  });
});
