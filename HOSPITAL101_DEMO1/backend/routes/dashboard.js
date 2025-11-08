import { Router } from "express";
import { withConn } from "../db.js";

const r = Router();

r.get("/", async (_req, res) => {
  try {
    const data = await withConn(async (conn) => {
      // ให้ session ทำงานที่โซนเวลาไทย กันเคส container เป็น UTC
      await conn.execute(`ALTER SESSION SET TIME_ZONE = '+07:00'`);

      const opt = { outFormat: 4002 }; // OBJECT rows
      const num = (rs) => Number(rs.rows[0].CNT || 0);

      const patients   = num(await conn.execute(`SELECT COUNT(*) CNT FROM patients`, [], opt));
      const doctors    = num(await conn.execute(`SELECT COUNT(*) CNT FROM doctors`, [], opt));
      const totalAppt  = num(await conn.execute(`SELECT COUNT(*) CNT FROM appointments`, [], opt));
      const completed  = num(await conn.execute(`SELECT COUNT(*) CNT FROM appointments WHERE status_id='S002'`, [], opt));
      const cancelled  = num(await conn.execute(`SELECT COUNT(*) CNT FROM appointments WHERE status_id='S003'`, [], opt));

      // นัดที่จะถึงใน 2 ชั่วโมง (เฉพาะ Scheduled)
      const upcoming2h = num(await conn.execute(
        `
        SELECT COUNT(*) CNT
        FROM appointments a
        WHERE a.status_id = 'S001'
          AND a.time_start IS NOT NULL
          AND TO_TIMESTAMP(
                TO_CHAR(a.appointment_date,'YYYY-MM-DD') || ' ' || a.time_start,
                'YYYY-MM-DD HH24:MI'
              )
              BETWEEN (SYSTIMESTAMP AT LOCAL)
                  AND (SYSTIMESTAMP AT LOCAL + INTERVAL '2' HOUR)
        `,
        [],
        opt
      ));

      return {
        patients,
        doctors,
        appointments: totalAppt,
        upcoming2h,
        pctComplete: totalAppt ? Math.round((completed / totalAppt) * 100) : 0,
        pctCancel:   totalAppt ? Math.round((cancelled / totalAppt) * 100) : 0,
      };
    });

    res.json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

export default r;
