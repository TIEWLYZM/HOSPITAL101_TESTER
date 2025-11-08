import "dotenv/config";
import express from "express";
import cors from "cors";
import { initPool, closePool } from "./db.js";
import optionsRoute from "./routes/options.js";
import appointmentsRoute from "./routes/appointments.js";
import dashboardRoute from "./routes/dashboard.js";
import viewsRoute from "./routes/views.js";

// -----------------------------
// ป้องกัน error ที่ยังไม่ได้ catch
// -----------------------------
process.on("unhandledRejection", (e) => {
  console.error("UNHANDLED_REJECTION:", e?.message || e);
});
process.on("uncaughtException", (e) => {
  console.error("UNCAUGHT_EXCEPTION:", e?.message || e);
});

// -----------------------------
// สร้าง express app
// -----------------------------
const app = express();

// ✅ ตั้งค่า CORS ให้ครบทุก method
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
}));
app.options("*", cors()); // รองรับ preflight DELETE/OPTIONS

// ✅ รองรับ JSON body
app.use(express.json());

// -----------------------------
// Routes หลัก
// -----------------------------
app.get("/health", (_, res) => res.json({ ok: true }));
app.use("/api/options", optionsRoute);
app.use("/api/appointments", appointmentsRoute);
app.use("/api/dashboard", dashboardRoute);
app.use("/api/views", viewsRoute);

// -----------------------------
// เริ่มต้นเซิร์ฟเวอร์
// -----------------------------
const port = process.env.PORT || 8080;

async function start() {
  while (true) {
    try {
      await initPool();
      console.log("DB pool init ✅");
      app.listen(port, () => console.log(`API listening on :${port}`));
      break;
    } catch (e) {
      console.error("DB not ready:", e.message);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}
start();

// -----------------------------
// ปิดการเชื่อมต่อฐานเมื่อ stop
// -----------------------------
process.on("SIGINT", async () => {
  await closePool();
  process.exit(0);
});
