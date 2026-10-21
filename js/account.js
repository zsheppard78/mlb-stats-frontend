// account.js — Sign in (username + password, or Google) and keep favorite teams saved to the account.
//
// While signed in, every ☆/★ change is saved to the backend, and signing in on another device
// brings the same teams back. Signed out, favorites stay in this browser only, as before.

import {
    addFavoriteTeam, getAuthConfig, getMe, registerAccount, removeFavoriteTeam, saveFavoriteList,
    signInWithGoogle, signInWithPassword, signOutSession
} from "./api.js";
import { closeModal, openModal } from "./modals.js";
import { setFavorites } from "./standings.js";
import { state } from "./state.js";
import { readJSON, showToast, writeJSON } from "./util.js";

const TOKEN_KEY = "authToken";
const USER_KEY = "authUser";

export const account = {
    token: null,
    user: null,          // { id, username, displayName, google }
    mode: "login",       // which form is showing: login | register
    config: null,        // { passwordSignIn, googleClientId } from the backend
    busy: false
};
try { account.token = localStorage.getItem(TOKEN_KEY); } catch { /* storage unavailable */ }
account.user = account.token ? readJSON(USER_KEY, null) : null;

const $ = id => document.getElementById(id);

// ------------------------------------------------------------------ saving the session

function saveSession(token, user) {
    account.token = token;
    account.user = user;
    try { localStorage.setItem(TOKEN_KEY, token); } catch { /* storage unavailable */ }
    writeJSON(USER_KEY, user);
    renderAccount();
}

function clearSession() {
    account.token = null;
    account.user = null;
    try {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
    } catch { /* storage unavailable */ }
    renderAccount();
}

/** After any sign-in: combine this browser's favorites with the account's, then save the result. */
async function finishSignIn(data, verb) {
    saveSession(data.token, data.user);
    const saved = data.favorites || [];
    const merged = [...saved, ...state.favorites.filter(id => !saved.includes(id))];
    let favorites = saved;
    if (merged.length !== saved.length) {
        try {
            favorites = (await saveFavoriteList(data.token, merged)).favorites;
        } catch {
            favorites = merged; // shown now, saved with the next change
        }
    }
    setFavorites(favorites);
    closeModal("accountModal");
    const n = favorites.length;
    showToast(`${verb} as ${data.user.displayName}${n ? ` · ${n} team${n === 1 ? "" : "s"} saved` : ""}`);
}

/** On page load: check the saved session is still good and load the account's favorites. */
async function restoreSession() {
    if (!account.token) return;
    try {
        const me = await getMe(account.token);
        saveSession(account.token, me.user);
        setFavorites(me.favorites);
    } catch (err) {
        if (err.status === 401) {
            clearSession();
            showToast("You were signed out. Sign in again to see your saved teams.");
        }
        // Server asleep or offline: keep the session and this browser's favorites for now
    }
}

// ------------------------------------------------------------------ favorites sync

let saving = Promise.resolve(); // keeps saves in the order they were made

function onFavoriteToggled(e) {
    if (!account.token) return;
    const { teamId, isFav } = e.detail;
    const token = account.token;
    saving = saving.then(() => (isFav ? addFavoriteTeam(token, teamId) : removeFavoriteTeam(token, teamId)))
        .catch(err => {
            if (err.status === 401) {
                clearSession();
                showToast("You were signed out, so that change was only saved on this device.");
            } else {
                showToast("Couldn't save that change to your account. It's saved on this device.");
            }
        });
}

// ------------------------------------------------------------------ the window

export function openAccount(opener) {
    renderAccount();
    clearError();
    openModal("accountModal", opener);
    if (!account.user) {
        // Right away: a delayed focus could pull the cursor back while someone is already typing
        $("acctUsername").focus();
        loadGoogleButton();
    }
}

function renderAccount() {
    const user = account.user;
    const label = user ? user.displayName : "Sign in";
    $("accountLabel").textContent = label;
    $("accountAvatar").textContent = user ? (user.displayName || "?").trim().charAt(0).toUpperCase() : "👤";
    $("accountBtn").classList.toggle("signed-in", !!user);
    $("accountBtn").setAttribute("aria-label", user ? `Account: signed in as ${user.displayName}` : "Sign in");
    $("accountMenuLabel").textContent = user ? "My account" : "Sign in";

    $("accountTitle").textContent = user ? "My account" : account.mode === "register" ? "Create an account" : "Sign in";
    $("accountSignedOut").hidden = !!user;
    $("accountSignedIn").hidden = !user;
    if (user) {
        $("accountName").textContent = user.displayName;
        $("accountMethod").textContent = user.google ? "Signed in with Google" : `Username: ${user.username}`;
        const n = state.favorites.length;
        $("accountSummary").textContent = n
            ? `Your ${n} favorite team${n === 1 ? " is" : "s are"} saved to your account and will show up on any device you sign in on.`
            : "Tap ☆ next to any team and it's saved to your account.";
    } else {
        const register = account.mode === "register";
        $("tabLogin").classList.toggle("active", !register);
        $("tabRegister").classList.toggle("active", register);
        $("tabLogin").setAttribute("aria-selected", String(!register));
        $("tabRegister").setAttribute("aria-selected", String(register));
        $("accountSubmit").textContent = register ? "Create account" : "Sign in";
        $("acctPassword").autocomplete = register ? "new-password" : "current-password";
        $("usernameHint").hidden = !register;
        $("passwordHint").hidden = !register;
    }
}

function setMode(mode) {
    account.mode = mode;
    clearError();
    renderAccount();
    $("acctUsername").focus();
}

function showError(message) {
    $("accountError").textContent = message;
    $("accountError").hidden = false;
}

function clearError() {
    $("accountError").hidden = true;
}

/** Disables the form while a request runs; after 3 s explains that the server may be waking up. */
async function busy(task) {
    if (account.busy) return;
    account.busy = true;
    clearError();
    const form = $("accountForm");
    form.querySelectorAll("input, button").forEach(el => { el.disabled = true; });
    $("accountModal").setAttribute("aria-busy", "true");
    const slow = setTimeout(() => { $("accountWait").hidden = false; }, 3000);
    try {
        await task();
    } catch (err) {
        showError(err.message || "Something went wrong. Try again.");
    } finally {
        clearTimeout(slow);
        $("accountWait").hidden = true;
        form.querySelectorAll("input, button").forEach(el => { el.disabled = false; });
        $("accountModal").removeAttribute("aria-busy");
        account.busy = false;
    }
}

function submitForm(e) {
    e.preventDefault();
    const username = $("acctUsername").value.trim();
    const password = $("acctPassword").value;
    const register = account.mode === "register";

    // Quick checks before asking the server (it checks again)
    if (!username || !password) return showError("Enter a username and password.");
    if (register && !/^[A-Za-z0-9_]{3,20}$/.test(username)) {
        return showError("Usernames are 3–20 characters: letters, numbers and underscores.");
    }
    if (register && password.length < 8) return showError("Passwords need at least 8 characters.");

    busy(async () => {
        const data = register ? await registerAccount(username, password) : await signInWithPassword(username, password);
        $("acctPassword").value = "";
        await finishSignIn(data, register ? "Account created. Signed in" : "Signed in");
    });
}

async function signOut() {
    const token = account.token;
    clearSession();
    setFavorites([]); // this device forgets the account's teams; they stay saved in the account
    closeModal("accountModal");
    showToast("Signed out. Your teams are saved in your account.");
    if (token) signOutSession(token).catch(() => { /* the session expires on its own */ });
}

// ------------------------------------------------------------------ Sign in with Google

let googleReady = null;

function loadGoogleScript() {
    if (window.google?.accounts?.id) return Promise.resolve();
    return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

/** Shows the Google button if the backend has a Google client id configured. */
function loadGoogleButton() {
    if (!googleReady) {
        googleReady = (async () => {
            account.config = account.config || await getAuthConfig();
            const clientId = account.config.googleClientId;
            if (!clientId) return false;
            await loadGoogleScript();
            window.google.accounts.id.initialize({
                client_id: clientId,
                callback: response => busy(async () => {
                    const data = await signInWithGoogle(response.credential);
                    await finishSignIn(data, "Signed in");
                })
            });
            return true;
        })().catch(() => {
            googleReady = null; // try again next time the window opens
            return false;
        });
    }
    googleReady.then(ok => {
        $("googleArea").hidden = !ok;
        const slot = $("googleBtn");
        if (!ok || slot.childElementCount) return;
        window.google.accounts.id.renderButton(slot, {
            theme: document.documentElement.dataset.mode === "dark" ? "filled_black" : "outline",
            size: "large", text: "continue_with", shape: "pill",
            width: Math.min(360, Math.max(220, slot.clientWidth || 320))
        });
    });
}

// ------------------------------------------------------------------ setup

export function setupAccount() {
    $("accountBtn").addEventListener("click", e => openAccount(e.currentTarget));
    $("closeAccount").addEventListener("click", () => closeModal("accountModal"));
    $("tabLogin").addEventListener("click", () => setMode("login"));
    $("tabRegister").addEventListener("click", () => setMode("register"));
    $("accountForm").addEventListener("submit", submitForm);
    $("signOutBtn").addEventListener("click", signOut);
    $("showPassword").addEventListener("click", e => {
        const input = $("acctPassword");
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        e.currentTarget.textContent = show ? "Hide" : "Show";
        e.currentTarget.setAttribute("aria-pressed", String(show));
    });
    document.addEventListener("mlb:favorite-toggled", onFavoriteToggled);
    renderAccount();
    restoreSession();
}
