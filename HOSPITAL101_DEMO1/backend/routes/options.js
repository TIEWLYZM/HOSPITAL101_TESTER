import { Router } from "express";
import { q } from "../db.js";
const r = Router();

r.get("/", async (_req, res) => {
  const [deps, docs, pats, rooms, types, statuses] = await Promise.all([
    q(`SELECT department_id, dept_name FROM departments ORDER BY dept_name`),
    q(`SELECT doctor_id, full_name, department_id FROM doctors ORDER BY full_name`),
    q(`SELECT patient_id, (first_name||' '||last_name) AS full_name FROM patients ORDER BY first_name, last_name`),
    q(`SELECT room_id, room_name FROM rooms ORDER BY room_name`),
    q(`SELECT type_id, type_name, default_duration_min FROM appointment_types ORDER BY type_name`),
    q(`SELECT status_id, status_name FROM appointment_statuses ORDER BY sort_order`)
  ]);
  res.json({
    departments: deps.rows, doctors: docs.rows, patients: pats.rows,
    rooms: rooms.rows, types: types.rows, statuses: statuses.rows
  });
});

export default r;
