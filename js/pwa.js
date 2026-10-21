// pwa.js — Install as an app: registers the service worker and the install button.

import { showToast } from "./util.js";

let installPrompt = null;

export function setupInstall() {
    if ("serviceWorker" in navigator && location.protocol !== "file:") {
        navigator.serviceWorker.register("sw.js").catch(err => console.warn("Service worker not registered:", err));
    }
    const btn = document.getElementById("installBtn");
    window.addEventListener("beforeinstallprompt", e => {
        e.preventDefault();
        installPrompt = e;
        btn.hidden = false;
    });
    btn.addEventListener("click", async () => {
        if (!installPrompt) return;
        installPrompt.prompt();
        await installPrompt.userChoice;
        installPrompt = null;
        btn.hidden = true;
    });
    window.addEventListener("appinstalled", () => { btn.hidden = true; showToast("Installed. Look for StatDugout on your home screen."); });
}
