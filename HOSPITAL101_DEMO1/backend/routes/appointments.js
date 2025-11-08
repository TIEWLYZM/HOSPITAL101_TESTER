// backend/routes/appointments.js
import { Router } from "express";
import { withConn } from "../db.js";
import { randomUUID } from "crypto";
const r = Router();

function addMinutesHHMM(hhmm, minutes) {
  if (!hhmm) return null;
  const [H, M] = hhmm.split(":").map(Number);
  const base = new Date(2000, 0, 1, H, M);
  const end = new Date(base.getTime() + minutes * 60000);
  const hh = String(end.getHours()).padStart(2, "0");
  const mm = String(end.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

const FINAL_STATUS = new Set(["S002", "S003"]); // Completed, Cancelled

// สร้างใบนัด
r.post("/", async (req, res) => {
  const {
    patient_id,
    doctor_id,
    department_id,
    room_id,
    type_id,
    appointment_date,
    time_start,
    duration_min = 0,
    notes,
    room_no,
  } = req.body;

  // ✅ กันข้อมูลหาย (จะได้ไม่ NULL ไปชน constraint)
  const missing = [];
  if (!patient_id) missing.push("patient_id");
  if (!doctor_id) missing.push("doctor_id");
  if (!department_id) missing.push("department_id");
  if (!type_id) missing.push("type_id");
  if (!appointment_date) missing.push("appointment_date");
  if (!time_start) missing.push("time_start");
  if (missing.length) {
    return res
      .status(400)
      .json({ ok: false, message: "ข้อมูลไม่ครบ", missing });
  }

  try {
    const result = await withConn(async (conn) => {
      // ดึง default duration จากประเภทนัด
      const t = await conn.execute(
        `SELECT default_duration_min FROM appointment_types WHERE type_id = :tid`,
        { tid: type_id },
        { outFormat: 4002 }
      );
      if (t.rows.length === 0) throw new Error("invalid type_id");

      const defDur = Number(t.rows[0].DEFAULT_DURATION_MIN);
      const totalDur = defDur + Number(duration_min || 0);
      const time_end = time_start ? addMinutesHHMM(time_start, totalDur) : null;

      const appointment_id = randomUUID();

      // บันทึกใบนัด
      await conn.execute(
        `INSERT INTO appointments (
           appointment_id, patient_id, doctor_id, department_id, room_id, type_id, status_id,
           appointment_date, time_start, time_end, duration_min, notes, room_no, created_by
         ) VALUES (
           :id, :pid, :did, :dept, :rid, :tid, 'S001',
           TO_DATE(:adate,'YYYY-MM-DD'), :tstart, :tend, :dur, :notes, :roomno, :created_by
         )`,
        {
          id: appointment_id,
          pid: patient_id,
          did: doctor_id,
          dept: department_id,
          rid: room_id || null,
          tid: type_id,
          adate: appointment_date,
          tstart: time_start,
          tend: time_end,
          dur: totalDur,
          notes: notes || null,
          roomno: room_no || null,
          created_by: doctor_id,
        }
      );

      // ประวัติสถานะเริ่มต้น
      await conn.execute(
        `INSERT INTO appointment_status_history (appointment_id, status_id, changed_by, note)
         VALUES (:id, 'S001', :changed_by, 'Created')`,
        { id: appointment_id, changed_by: doctor_id }
      );

      await conn.commit();
      return { appointment_id, time_end, totalDur };
    });

    res.json({ ok: true, message: "บันทึกสำเร็จ", data: result });
  } catch (err) {
    res
      .status(400)
      .json({
        ok: false,
        message: "บันทึกล้มเหลว",
        error: String(err.message || err),
      });
  }
});

// เปลี่ยนสถานะใบนัด
r.patch("/:id/status", async (req, res) => {
  const { id } = req.params;
  const { new_status_id, changed_by, cancel_reason } = req.body;

  if (!new_status_id) {
    return res
      .status(400)
      .json({ ok: false, message: "ต้องระบุ new_status_id" });
  }

  try {
    const out = await withConn(async (conn) => {
      const cur = await conn.execute(
        `SELECT status_id, time_start, time_end, duration_min, type_id
           FROM appointments WHERE appointment_id = :id`,
        { id },
        { outFormat: 4002 }
      );
      if (cur.rows.length === 0) throw new Error("ไม่พบใบนัด");
      const curr = cur.rows[0];
      if (FINAL_STATUS.has(curr.STATUS_ID)) {
        throw new Error("นัดนี้ถูกปิดแล้ว (Completed/Cancelled) แก้ไขไม่ได้");
      }

      let time_end = curr.TIME_END;

      // ถ้า Confirm ครั้งแรกและยังไม่มี time_end ให้คำนวณให้
      if (new_status_id === "S002" && !time_end && curr.TIME_START) {
        const t = await conn.execute(
          `SELECT default_duration_min FROM appointment_types WHERE type_id=:tid`,
          { tid: curr.TYPE_ID },
          { outFormat: 4002 }
        );
        const defDur = Number(t.rows[0].DEFAULT_DURATION_MIN);
        const totalDur = defDur + Number(curr.DURATION_MIN || 0);
        time_end = addMinutesHHMM(curr.TIME_START, totalDur);

        await conn.execute(
          `UPDATE appointments SET time_end=:tend WHERE appointment_id=:id`,
          { tend: time_end, id }
        );
      }

      // อัปเดตสถานะ (บันทึกเหตุผลยกเลิกเฉพาะ Cancel)
      await conn.execute(
        `UPDATE appointments
            SET status_id=:st,
                cancel_reason=:cr
          WHERE appointment_id=:id`,
        {
          st: new_status_id,
          cr: new_status_id === "S003" ? cancel_reason || "" : null,
          id,
        }
      );

      // ประวัติสถานะ
      await conn.execute(
        `INSERT INTO appointment_status_history (appointment_id, status_id, changed_by, note)
         VALUES (:id, :st, :changed_by, :note)`,
        {
          id,
          st: new_status_id,
          changed_by: changed_by || null,
          note: cancel_reason || null,
        }
      );

      await conn.commit();
      return { time_end };
    });

    res.json({ ok: true, message: "อัพเดตสถานะสำเร็จ", data: out });
  } catch (err) {
    res
      .status(400)
      .json({
        ok: false,
        message: "อัพเดตสถานะล้มเหลว",
        error: String(err.message || err),
      });
  }
});

// ======================= GET /api/appointments/:id (รายละเอียดเต็ม) =======================
r.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const data = await withConn(async (conn) => {
      const ap = await conn.execute(
        `
        SELECT
          a.appointment_id,
          TO_CHAR(a.appointment_date, 'YYYY-MM-DD') AS appointment_date,
          a.time_start, a.time_end, a.duration_min, a.notes, a.room_no,
          a.status_id, s.status_name,
          p.patient_id, (p.first_name||' '||p.last_name) AS patient_name,
          d.doctor_id, d.full_name AS doctor_name,
          dep.department_id, dep.dept_name,
          r.room_id, r.room_name,
          t.type_id, t.type_name
        FROM appointments a
          LEFT JOIN appointment_statuses s ON s.status_id = a.status_id
          LEFT JOIN patients p ON p.patient_id = a.patient_id
          LEFT JOIN doctors d ON d.doctor_id = a.doctor_id
          LEFT JOIN departments dep ON dep.department_id = a.department_id
          LEFT JOIN rooms r ON r.room_id = a.room_id
          LEFT JOIN appointment_types t ON t.type_id = a.type_id
        WHERE a.appointment_id = :id
        `,
        { id },
        { outFormat: 4002 }
      );

      if (ap.rows.length === 0) return null;

      const hist = await conn.execute(
        `
        SELECT
          h.status_id, s.status_name,
          TO_CHAR(h.changed_at, 'YYYY-MM-DD HH24:MI') AS changed_at,
          h.changed_by, h.note
        FROM appointment_status_history h
          LEFT JOIN appointment_statuses s ON s.status_id = h.status_id
        WHERE h.appointment_id = :id
        ORDER BY h.changed_at
        `,
        { id },
        { outFormat: 4002 }
      );

      return { appointment: ap.rows[0], history: hist.rows };
    });

    if (!data)
      return res.status(404).json({ ok: false, message: "ไม่พบใบนัด" });
    res.json({ ok: true, ...data });
  } catch (err) {
    res.status(400).json({ ok: false, message: String(err.message || err) });
  }
});

// DELETE /api/appointments/:id  ลบใบนัด + ประวัติสถานะ
r.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const out = await withConn(async (conn) => {
      // ลบประวัติสถานะก่อน กัน FK ชน
      await conn.execute(
        `DELETE FROM appointment_status_history WHERE appointment_id = :id`,
        { id }
      );
      const r = await conn.execute(
        `DELETE FROM appointments WHERE appointment_id = :id`,
        { id }
      );
      await conn.commit();
      return { affected: r.rowsAffected || 0 };
    });

    if (out.affected === 0) {
      return res.status(404).json({ ok: false, message: "ไม่พบใบนัดที่จะลบ" });
    }
    res.json({ ok: true, message: "ลบสำเร็จ", ...out });
  } catch (err) {
    res.status(400).json({ ok: false, message: String(err.message || err) });
  }
});

export default r;
