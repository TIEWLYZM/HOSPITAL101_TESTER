// frontend/public/js/api.js

export const API_BASE =
  (location.hostname === "localhost" || location.hostname === "127.0.0.1")
    ? "http://localhost:8080"
    : "";

async function safeJson(res) {
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  if (ct.includes("application/json")) return res.json();
  const text = await res.text();
  throw new Error(`HTTP ${res.status} ${res.statusText} — ${text.slice(0,200)}`);
}

export async function apiGet(path) {
  const r = await fetch(`${API_BASE}${path}`);
  return safeJson(r);
}
export async function apiPost(path, body) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return safeJson(r);
}
export async function apiPatch(path, body) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return safeJson(r);
}
export async function apiDelete(path) {
  const r = await fetch(`${API_BASE}${path}`, { method: "DELETE" });
  return safeJson(r);
}
