// util.js — Small shared helpers: HTML escaping, saved settings, toasts and date formatting.

export function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => (
        { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
}

export function readJSON(key, fallback) {
    try {
        const v = JSON.parse(localStorage.getItem(key));
        return v ?? fallback;
    } catch {
        return fallback;
    }
}

export function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

let toastTimer;

export function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.hidden = false;
    requestAnimationFrame(() => toast.classList.add("show"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => { toast.hidden = true; }, 250);
    }, 2500);
}

// Img fallback for team logos (some teams may not have the dark-background version)
document.addEventListener("error", e => {
    const img = e.target;
    if (img.tagName === "IMG" && img.dataset.fallback && img.src !== img.dataset.fallback) {
        img.src = img.dataset.fallback;
    }
}, true);

export function formatDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso + "T12:00:00");
    return isNaN(d) ? iso : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function isoDate(d) {
    const pad = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISODate(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d, 12);
}

export function addDays(iso, n) {
    const d = parseISODate(iso);
    d.setDate(d.getDate() + n);
    return isoDate(d);
}

export function dayLabel(iso) {
    const today = isoDate(new Date());
    const d = parseISODate(iso);
    const long = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    if (iso === today) return `Today, ${long}`;
    if (iso === addDays(today, -1)) return `Yesterday, ${long}`;
    if (iso === addDays(today, 1)) return `Tomorrow, ${long}`;
    return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export const shortDate = iso => parseISODate(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export const gameTime = iso => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
