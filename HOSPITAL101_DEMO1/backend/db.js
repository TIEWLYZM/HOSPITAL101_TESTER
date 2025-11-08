import oracledb from "oracledb";

const cfg = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectString: `${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_SERVICE}`,
  poolMin: 0,           // delay making connections until needed
  poolMax: 5,
  poolIncrement: 1,
  queueTimeout: 60000,
  poolPingInterval: 60
};

// ✅ ให้ทุกคอลัมน์ชนิด DATE ส่งออกเป็น string แทนที่จะเป็น JS Date
oracledb.fetchAsString = [ oracledb.DATE ];

let pool;
export async function initPool() {
  if (!pool) pool = await oracledb.createPool(cfg);
}
export async function closePool() {
  if (pool) await pool.close(0);
}
async function getConnWithRetry(retries = 10, delayMs = 2000) {
  let lastErr;
  for (let i=0;i<retries;i++){
    try {
      return await pool.getConnection();
    } catch (e) {
      lastErr = e;
      if (String(e.message||'').includes('Service') && String(e.message).includes('not registered')) {
        await new Promise(r => setTimeout(r, delayMs));
        continue;
      }
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}
export async function q(sql, binds = {}, opts = {}) {
  const conn = await getConnWithRetry();
  try {
    const res = await conn.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT, autoCommit: false, ...opts });
    return res;
  } finally {
    await conn.close();
  }
}
export async function withConn(fn) {
  const conn = await getConnWithRetry();
  try {
    const res = await fn(conn);
    return res;
  } finally {
    await conn.close();
  }
}
