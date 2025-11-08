import { Router } from "express";
import { q } from "../db.js";
const r = Router();

// รายการวิวที่มีอยู่จริงตาม 01_HOSPITAL101_TABLE.sql
const ALLOW = new Set([
  "rooms_by_department",
  "doctors_by_department",
  "patients_appointments_by_department",
  "patients_by_doctor_name",
  "patient_appointment_status",
  "appointment_status_history_view",
  "department_doctor_counts",
  "department_patient_counts",
  "department_with_most_doctors",
  "department_with_most_patients",
  "appointments_completed",
  "appointments_cancelled"
]);

r.get("/:view", async (req, res) => {
  try {
    const view = (req.params.view || "").toLowerCase();
    if (!ALLOW.has(view)) {
      return res.status(400).json({ ok: false, message: "ไม่อนุญาตหรือไม่มีวิว" });
    }

    // ป้องกัน query injection ด้วย allow-list แล้วค่อยเสียบชื่อวิว
    const sql = `SELECT * FROM ${view} FETCH FIRST 500 ROWS ONLY`;
    const data = await q(sql);
    res.json({ ok: true, rows: data.rows });
  } catch (err) {
    res.status(400).json({ ok: false, message: String(err.message || err) });
  }
});

export default r;
