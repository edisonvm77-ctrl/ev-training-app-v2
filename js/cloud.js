/**
 * Cloud module - Firebase Realtime Database wrapper.
 *
 * Strategy: localStorage acts as a fast in-memory cache; Firebase is the source of truth.
 * Every Storage write is mirrored to Firebase asynchronously (fire-and-forget).
 * On boot the app hydrates from Firebase before showing the UI so users see the latest data
 * across devices.
 *
 * Security:
 *  - Anonymous Firebase Auth is used so the Firebase RTDB security rules can require auth.
 *  - apiKey is "public" by design — the real security boundary is the database rules
 *    (see SETUP.md for the recommended rules).
 *  - Custom username/password remains the app-level identity; Firebase auth only
 *    proves the request comes from a valid client.
 */

const Cloud = (() => {
    const CONFIG = {
        apiKey: "AIzaSyALX4P2X2Et8f4h4nQQe4_q9Qqv1LL7rPw",
        authDomain: "ev-training-a8989.firebaseapp.com",
        databaseURL: "https://ev-training-a8989-default-rtdb.firebaseio.com",
        projectId: "ev-training-a8989",
        storageBucket: "ev-training-a8989.firebasestorage.app",
        messagingSenderId: "774037053186",
        appId: "1:774037053186:web:c61a04c8cbfbfccc14ec1b",
        measurementId: "G-SSKJEWRVTC"
    };

    let initialized = false;
    let initPromise = null;
    let db = null;
    let auth = null;
    let fbUser = null;
    let listeners = new Map();
    const subscribers = new Set();
    // Offline queue: writes done before Firebase is ready get flushed on connect.
    const pendingSets = new Map();   // path -> value
    const pendingRemoves = new Set(); // path

    function notifyState(state) {
        for (const cb of subscribers) {
            try { cb(state); } catch (e) { /* ignore */ }
        }
    }

    function onState(cb) {
        subscribers.add(cb);
        return () => subscribers.delete(cb);
    }

    /**
     * Initialize Firebase + sign in anonymously.
     * Idempotent. Returns true if ready.
     */
    function init() {
        if (initialized) return Promise.resolve(true);
        if (initPromise) return initPromise;
        if (typeof firebase === 'undefined' || typeof firebase.initializeApp !== 'function') {
            console.warn('[Cloud] Firebase SDK not loaded');
            notifyState({ status: 'unavailable' });
            return Promise.resolve(false);
        }
        notifyState({ status: 'connecting' });
        initPromise = (async () => {
            try {
                if (!firebase.apps || firebase.apps.length === 0) {
                    firebase.initializeApp(CONFIG);
                }
                db = firebase.database();
                auth = firebase.auth();

                // Try to use local persistence (works on Web)
                try { await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL); } catch (e) { /* not supported */ }

                // Listen for auth changes (fires on first auth)
                await new Promise((resolve, reject) => {
                    let resolved = false;
                    const tm = setTimeout(() => {
                        if (!resolved) reject(new Error('Auth timeout'));
                    }, 15000);
                    auth.onAuthStateChanged(async user => {
                        if (resolved) return;
                        if (user) {
                            fbUser = user;
                        } else {
                            try { await auth.signInAnonymously(); } catch (e) { /* will be handled */ }
                            return;
                        }
                        resolved = true;
                        clearTimeout(tm);
                        resolve();
                    }, err => {
                        if (resolved) return;
                        resolved = true;
                        clearTimeout(tm);
                        reject(err);
                    });
                });

                initialized = true;
                notifyState({ status: 'connected', uid: fbUser && fbUser.uid });
                console.log('[Cloud] Ready, anonymous uid:', fbUser && fbUser.uid);
                // Flush any writes that were queued while offline
                flushPending();
                return true;
            } catch (e) {
                console.error('[Cloud] Init failed:', e);
                notifyState({ status: 'error', error: e.message });
                return false;
            }
        })();
        return initPromise;
    }

    function isReady() {
        return initialized && db != null;
    }

    /**
     * Pull the entire database snapshot (one-time read).
     * Used to hydrate localStorage at boot.
     */
    async function pullAll() {
        if (!isReady()) return null;
        try {
            const snap = await db.ref('/').once('value');
            return snap.val() || {};
        } catch (e) {
            console.warn('[Cloud] pullAll failed:', e);
            return null;
        }
    }

    /**
     * Set the value at a path (overwrites).
     * Fire-and-forget — does not block caller. Errors logged.
     * If Firebase isn't ready yet, the write is queued and flushed on connect.
     */
    function set(path, value) {
        if (!isReady()) {
            pendingSets.set(path, value);
            pendingRemoves.delete(path);
            return Promise.resolve(false);
        }
        return db.ref(path).set(value)
            .then(() => true)
            .catch(e => { console.warn('[Cloud] set ' + path + ' failed:', e.message); return false; });
    }

    function update(path, partial) {
        if (!isReady()) return Promise.resolve(false);
        return db.ref(path).update(partial)
            .then(() => true)
            .catch(e => { console.warn('[Cloud] update ' + path + ' failed:', e.message); return false; });
    }

    function remove(path) {
        if (!isReady()) {
            pendingRemoves.add(path);
            pendingSets.delete(path);
            return Promise.resolve(false);
        }
        return db.ref(path).remove()
            .then(() => true)
            .catch(e => { console.warn('[Cloud] remove ' + path + ' failed:', e.message); return false; });
    }

    function flushPending() {
        if (!isReady()) return;
        if (pendingSets.size === 0 && pendingRemoves.size === 0) return;
        console.log('[Cloud] Flushing', pendingSets.size, 'sets,', pendingRemoves.size, 'removes');
        for (const [path, value] of pendingSets) {
            db.ref(path).set(value).catch(e => console.warn('[Cloud] flush set failed', path, e.message));
        }
        for (const path of pendingRemoves) {
            db.ref(path).remove().catch(e => console.warn('[Cloud] flush remove failed', path, e.message));
        }
        pendingSets.clear();
        pendingRemoves.clear();
    }

    /**
     * Subscribe to live changes at a path. Returns an unsubscribe fn.
     */
    function watch(path, callback) {
        if (!isReady()) return () => {};
        const ref = db.ref(path);
        const handler = snap => {
            try { callback(snap.val()); } catch (e) { console.warn(e); }
        };
        ref.on('value', handler);
        const key = path + '#' + Math.random().toString(36).slice(2);
        listeners.set(key, () => ref.off('value', handler));
        return () => {
            const off = listeners.get(key);
            if (off) { off(); listeners.delete(key); }
        };
    }

    function unwatchAll() {
        for (const off of listeners.values()) {
            try { off(); } catch (e) { /* ignore */ }
        }
        listeners.clear();
    }

    // ====== Path builders ======
    const paths = {
        user: id => '/users/' + id,
        userIndex: username => '/usernameIndex/' + (username || '').toLowerCase(),
        session: (userId, sessionId) => '/sessions/' + userId + '/' + sessionId,
        userSessions: userId => '/sessions/' + userId,
        bodyMetric: (userId, entryId) => '/bodyMetrics/' + userId + '/' + entryId,
        userBody: userId => '/bodyMetrics/' + userId,
        override: (userId, exerciseId) => '/overrides/' + userId + '/' + exerciseId,
        userOverrides: userId => '/overrides/' + userId,
        userSettings: userId => '/userSettings/' + userId
    };

    return {
        init, isReady, pullAll,
        set, update, remove, watch, unwatchAll,
        onState,
        paths,
        get currentUid() { return fbUser && fbUser.uid; }
    };
})();
