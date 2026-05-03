/**
 * Storage layer - localStorage as a fast cache, Firebase RTDB as source of truth.
 * Every write also fires a non-blocking push to Firebase via the Cloud module.
 */

const Storage = (() => {
    const KEYS = {
        USERS: 'evt:users',
        SESSIONS: 'evt:sessions',
        CURRENT_USER: 'evt:currentUser',
        BODYWEIGHT: 'evt:bodyweight',
        SETTINGS: 'evt:settings',
        OVERRIDES: 'evt:overrides',         // user-specific exercise overrides
        USER_SETTINGS: 'evt:userSettings'   // per-user prefs (auto-rest, etc.)
    };

    function read(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (e) {
            console.error('Storage read error', e);
            return fallback;
        }
    }
    function write(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('Storage write error', e);
            return false;
        }
    }

    /**
     * Helper: send a cloud write. Never throws.
     * Cloud queues the write internally if Firebase isn't ready yet so we
     * always go through Cloud.set/.remove (it's safe).
     */
    function cloudSet(path, value) {
        try {
            if (typeof Cloud !== 'undefined' && Cloud.set) Cloud.set(path, value);
        } catch (e) { /* swallow */ }
    }
    function cloudUpdate(path, partial) {
        try {
            if (typeof Cloud !== 'undefined' && Cloud.update) Cloud.update(path, partial);
        } catch (e) { /* swallow */ }
    }
    function cloudRemove(path) {
        try {
            if (typeof Cloud !== 'undefined' && Cloud.remove) Cloud.remove(path);
        } catch (e) { /* swallow */ }
    }

    // ===== USERS =====
    function getUsers() { return read(KEYS.USERS, []); }
    function saveUsers(users) { return write(KEYS.USERS, users); }
    function getUser(id) { return getUsers().find(u => u.id === id); }
    function getUserByUsername(username) {
        return getUsers().find(u => u.username.toLowerCase() === username.toLowerCase());
    }
    function upsertUser(user) {
        const users = getUsers();
        const idx = users.findIndex(u => u.id === user.id);
        if (idx >= 0) users[idx] = user;
        else users.push(user);
        saveUsers(users);
        // Push to cloud
        cloudSet(Cloud.paths.user(user.id), user);
        if (user.username) {
            cloudSet(Cloud.paths.userIndex(user.username), user.id);
        }
        return user;
    }
    function deleteUser(id) {
        const target = getUser(id);
        const users = getUsers().filter(u => u.id !== id);
        saveUsers(users);
        // Also clear their sessions
        const sessions = getSessions().filter(s => s.userId !== id);
        saveSessions(sessions);
        // Cloud cleanup
        cloudRemove(Cloud.paths.user(id));
        cloudRemove(Cloud.paths.userSessions(id));
        cloudRemove(Cloud.paths.userBody(id));
        cloudRemove(Cloud.paths.userOverrides(id));
        cloudRemove(Cloud.paths.userSettings(id));
        if (target && target.username) cloudRemove(Cloud.paths.userIndex(target.username));
    }

    // ===== CURRENT USER =====
    function getCurrentUser() {
        const id = localStorage.getItem(KEYS.CURRENT_USER);
        return id ? getUser(id) : null;
    }
    function setCurrentUser(id) {
        if (id) localStorage.setItem(KEYS.CURRENT_USER, id);
        else localStorage.removeItem(KEYS.CURRENT_USER);
    }

    // ===== SESSIONS =====
    function getSessions() { return read(KEYS.SESSIONS, []); }
    function saveSessions(sessions) { return write(KEYS.SESSIONS, sessions); }
    function getUserSessions(userId) {
        return getSessions().filter(s => s.userId === userId).sort((a,b) => new Date(b.date) - new Date(a.date));
    }
    function saveSession(session) {
        const all = getSessions();
        const idx = all.findIndex(s => s.id === session.id);
        if (idx >= 0) all[idx] = session;
        else all.push(session);
        saveSessions(all);
        // Push to cloud nested under user
        if (session.userId && session.id) {
            cloudSet(Cloud.paths.session(session.userId, session.id), session);
        }
        return session;
    }
    function deleteSession(id) {
        const target = getSessions().find(s => s.id === id);
        const sessions = getSessions().filter(s => s.id !== id);
        saveSessions(sessions);
        if (target && target.userId) {
            cloudRemove(Cloud.paths.session(target.userId, id));
        }
    }

    // ===== BODY METRICS (weight + measurements) =====
    /**
     * Each entry shape:
     * { id, date (ISO), weight, chest, waist, biceps, quadriceps, calves, back, notes }
     * All measurements are optional except date.
     */
    function getBodyMetrics(userId) {
        const all = read(KEYS.BODYWEIGHT, {});
        const list = all[userId] || [];
        // Migrate legacy entries that used { kg, date }
        return list.map(e => {
            if (e.kg != null && e.weight == null) {
                return { id: e.id || ('bm_' + (e.date || Date.now())), date: e.date, weight: e.kg };
            }
            return e;
        }).sort((a, b) => new Date(b.date) - new Date(a.date));
    }
    function addBodyMetric(userId, entry) {
        if (!userId) return null;
        const all = read(KEYS.BODYWEIGHT, {});
        if (!all[userId]) all[userId] = [];
        const sanitized = {
            id: entry.id || ('bm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
            date: entry.date || new Date().toISOString(),
            weight: numOrNull(entry.weight),
            chest: numOrNull(entry.chest),
            waist: numOrNull(entry.waist),
            biceps: numOrNull(entry.biceps),
            quadriceps: numOrNull(entry.quadriceps),
            calves: numOrNull(entry.calves),
            back: numOrNull(entry.back),
            notes: typeof entry.notes === 'string' ? entry.notes.slice(0, 500) : ''
        };
        all[userId].push(sanitized);
        write(KEYS.BODYWEIGHT, all);
        cloudSet(Cloud.paths.bodyMetric(userId, sanitized.id), sanitized);
        return sanitized;
    }
    function deleteBodyMetric(userId, id) {
        const all = read(KEYS.BODYWEIGHT, {});
        if (!all[userId]) return;
        all[userId] = all[userId].filter(e => e.id !== id);
        write(KEYS.BODYWEIGHT, all);
        cloudRemove(Cloud.paths.bodyMetric(userId, id));
    }
    function numOrNull(v) {
        if (v === '' || v == null) return null;
        const n = parseFloat(v);
        return isNaN(n) ? null : n;
    }
    // Legacy aliases
    function getBodyweight(userId) { return getBodyMetrics(userId); }
    function addBodyweight(userId, kg, date) {
        return addBodyMetric(userId, { date: date || new Date().toISOString(), weight: kg });
    }

    // ===== SETTINGS =====
    function getSettings() { return read(KEYS.SETTINGS, { autoSync: true, soundsEnabled: true }); }
    function saveSettings(s) { write(KEYS.SETTINGS, s); }

    // ===== USER SETTINGS (per-user prefs) =====
    const DEFAULT_USER_SETTINGS = {
        autoRestTimer: false,    // user wants auto rest timer after each set?
        soundsEnabled: true,
        theme: 'dark'            // default appearance
    };
    function getUserSettings(userId) {
        const all = read(KEYS.USER_SETTINGS, {});
        return { ...DEFAULT_USER_SETTINGS, ...(all[userId] || {}) };
    }
    function saveUserSettings(userId, settings) {
        const all = read(KEYS.USER_SETTINGS, {});
        all[userId] = { ...getUserSettings(userId), ...settings };
        write(KEYS.USER_SETTINGS, all);
        cloudSet(Cloud.paths.userSettings(userId), all[userId]);
        return all[userId];
    }

    // ===== EXERCISE OVERRIDES (per user) =====
    function getOverrides(userId) {
        const all = read(KEYS.OVERRIDES, {});
        return all[userId] || {};
    }
    function getOverride(userId, exerciseId) {
        return getOverrides(userId)[exerciseId] || null;
    }
    function setOverride(userId, exerciseId, override) {
        if (!userId || !exerciseId) return null;
        const all = read(KEYS.OVERRIDES, {});
        if (!all[userId]) all[userId] = {};
        // Sanitize fields: bound the data we store to prevent abuse
        const sanitized = { ...(all[userId][exerciseId] || {}) };
        if ('tips' in override) {
            sanitized.tips = override.tips == null ? null : String(override.tips).slice(0, 2000);
        }
        if ('name' in override) {
            sanitized.name = override.name == null ? null : String(override.name).slice(0, 120);
        }
        if ('rest' in override) {
            const n = parseInt(override.rest, 10);
            sanitized.rest = (isNaN(n) || n < 5 || n > 1800) ? null : n;
        }
        if ('imageUrl' in override) {
            const url = override.imageUrl;
            if (url == null) {
                sanitized.imageUrl = null;
            } else if (typeof url === 'string' && /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(url) && url.length < 6_000_000) {
                sanitized.imageUrl = url;
            } else {
                // Reject non-data URLs and anything suspicious
                sanitized.imageUrl = null;
            }
        }
        if ('target' in override && override.target) {
            const t = override.target;
            const sets = parseInt(t.sets, 10);
            const repMin = parseInt(t.repMin, 10);
            const repMax = parseInt(t.repMax, 10);
            sanitized.target = {
                sets: (isNaN(sets) || sets < 1 || sets > 20) ? 1 : sets,
                repMin: (isNaN(repMin) || repMin < 1 || repMin > 100) ? 1 : repMin,
                repMax: (isNaN(repMax) || repMax < 1 || repMax > 100) ? 1 : Math.max(repMax, repMin || 1)
            };
        }
        all[userId][exerciseId] = sanitized;
        write(KEYS.OVERRIDES, all);
        cloudSet(Cloud.paths.override(userId, exerciseId), sanitized);
        return sanitized;
    }
    function clearOverride(userId, exerciseId) {
        const all = read(KEYS.OVERRIDES, {});
        if (all[userId]) {
            delete all[userId][exerciseId];
            write(KEYS.OVERRIDES, all);
        }
        cloudRemove(Cloud.paths.override(userId, exerciseId));
    }

    // ===== EFFECTIVE EXERCISE =====
    /**
     * Returns the exercise data combined with:
     *  1) user overrides (custom tips, target, rest, image)
     *  2) the user's most recent session for this exercise (used as suggested values)
     * Looks in both built-in ROUTINES and the user's customRoutines.
     */
    function getEffectiveExercise(routineId, exerciseId, userId) {
        let routine = ROUTINES.find(r => r.id === routineId);
        if (!routine) {
            const user = getUser(userId);
            if (user && Array.isArray(user.customRoutines)) {
                routine = user.customRoutines.find(r => r && r.id === routineId);
            }
        }
        if (!routine) return null;
        const base = routine.exercises.find(e => e.id === exerciseId);
        if (!base) return null;

        const ov = getOverride(userId, exerciseId) || {};
        const lastReal = getLastExerciseSession(userId, routineId, exerciseId);

        const merged = {
            ...base,
            target: { ...base.target, ...(ov.target || {}) },
            tips: ov.tips != null ? ov.tips : base.tips,
            rest: ov.rest != null ? ov.rest : base.rest,
            imageUrl: ov.imageUrl || null,
            customName: ov.name || null,
            // Use last real session sets if available; otherwise fall back to data.js lastSession
            lastSession: lastReal || base.lastSession || []
        };
        return merged;
    }

    /**
     * Returns the array of completed sets from the user's most recent session
     * for the given routine + exercise.
     */
    function getLastExerciseSession(userId, routineId, exerciseId) {
        const sessions = getUserSessions(userId)
            .filter(s => s.routineId === routineId);
        for (const s of sessions) {
            const ex = (s.exercises || []).find(e => e.id === exerciseId);
            if (ex && ex.sets && ex.sets.some(set => set.completed)) {
                return ex.sets
                    .filter(set => set.completed)
                    .map(set => ({ weight: set.weight, reps: set.reps }));
            }
        }
        return null;
    }

    // ===== EXPORT / IMPORT =====
    function exportAll() {
        return {
            version: 1,
            exportedAt: new Date().toISOString(),
            users: getUsers(),
            sessions: getSessions(),
            bodyweight: read(KEYS.BODYWEIGHT, {}),
            settings: getSettings()
        };
    }
    function importAll(data) {
        if (!data || !data.version) throw new Error('Archivo inválido');
        if (Array.isArray(data.users)) saveUsers(data.users);
        if (Array.isArray(data.sessions)) saveSessions(data.sessions);
        if (data.bodyweight) write(KEYS.BODYWEIGHT, data.bodyweight);
        if (data.settings) saveSettings(data.settings);
    }

    // ===== INITIALIZE WITH DEFAULT ADMIN =====
    function initialize() {
        const users = getUsers();
        if (users.length === 0) {
            const admin = { ...DEFAULT_ADMIN, password: hashPassword(DEFAULT_ADMIN.password) };
            saveUsers([admin]);
            // Will get pushed to cloud after Cloud.init via hydrateFromCloud merge
        }
    }

    /**
     * Merge a remote snapshot from Firebase into local cache.
     * Cloud is the source of truth: values present in both are taken from cloud.
     * Local-only items are preserved (so an offline-created session is not wiped).
     */
    function hydrateFromCloud(snapshot) {
        if (!snapshot || typeof snapshot !== 'object') return;

        // Users: cloud is authoritative; replace local list with cloud users (plus any unsynced local).
        if (snapshot.users && typeof snapshot.users === 'object') {
            const remoteUsers = Object.values(snapshot.users).filter(u => u && u.id);
            const localUsers = getUsers();
            const merged = new Map();
            for (const u of localUsers) merged.set(u.id, u);
            for (const u of remoteUsers) merged.set(u.id, u); // remote overwrites
            saveUsers([...merged.values()]);
        }

        // Sessions: union by id, remote wins on conflict
        if (snapshot.sessions && typeof snapshot.sessions === 'object') {
            const local = getSessions();
            const merged = new Map();
            for (const s of local) merged.set(s.id, s);
            for (const userId in snapshot.sessions) {
                const userSessions = snapshot.sessions[userId];
                if (!userSessions) continue;
                for (const sid in userSessions) {
                    const s = userSessions[sid];
                    if (s && s.id) merged.set(s.id, { ...s, userId });
                }
            }
            saveSessions([...merged.values()]);
        }

        // Body metrics: union by id, remote wins
        if (snapshot.bodyMetrics && typeof snapshot.bodyMetrics === 'object') {
            const all = read(KEYS.BODYWEIGHT, {});
            for (const userId in snapshot.bodyMetrics) {
                const userMetrics = snapshot.bodyMetrics[userId] || {};
                const local = (all[userId] || []);
                const merged = new Map();
                for (const e of local) if (e && e.id) merged.set(e.id, e);
                for (const id in userMetrics) {
                    const e = userMetrics[id];
                    if (e && e.id) merged.set(e.id, e);
                }
                all[userId] = [...merged.values()];
            }
            write(KEYS.BODYWEIGHT, all);
        }

        // Overrides: cloud authoritative per (userId, exerciseId)
        if (snapshot.overrides && typeof snapshot.overrides === 'object') {
            const all = read(KEYS.OVERRIDES, {});
            for (const userId in snapshot.overrides) {
                if (!all[userId]) all[userId] = {};
                const remote = snapshot.overrides[userId] || {};
                for (const exId in remote) {
                    all[userId][exId] = remote[exId];
                }
            }
            write(KEYS.OVERRIDES, all);
        }

        // User settings: cloud authoritative
        if (snapshot.userSettings && typeof snapshot.userSettings === 'object') {
            const all = read(KEYS.USER_SETTINGS, {});
            for (const userId in snapshot.userSettings) {
                all[userId] = { ...(all[userId] || {}), ...(snapshot.userSettings[userId] || {}) };
            }
            write(KEYS.USER_SETTINGS, all);
        }
    }

    /**
     * Push the entire local cache to the cloud (once after first ever boot
     * or after an import). Used to seed Firebase the first time.
     */
    function pushAllToCloud() {
        if (typeof Cloud === 'undefined' || !Cloud.isReady()) return;
        for (const u of getUsers()) {
            cloudSet(Cloud.paths.user(u.id), u);
            if (u.username) cloudSet(Cloud.paths.userIndex(u.username), u.id);
        }
        for (const s of getSessions()) {
            if (s.userId && s.id) cloudSet(Cloud.paths.session(s.userId, s.id), s);
        }
        const bw = read(KEYS.BODYWEIGHT, {});
        for (const userId in bw) {
            for (const e of (bw[userId] || [])) {
                if (e && e.id) cloudSet(Cloud.paths.bodyMetric(userId, e.id), e);
            }
        }
        const ov = read(KEYS.OVERRIDES, {});
        for (const userId in ov) {
            for (const exId in (ov[userId] || {})) {
                cloudSet(Cloud.paths.override(userId, exId), ov[userId][exId]);
            }
        }
        const us = read(KEYS.USER_SETTINGS, {});
        for (const userId in us) {
            cloudSet(Cloud.paths.userSettings(userId), us[userId]);
        }
    }

    // Light hashing - not cryptographically secure but obfuscates passwords in localStorage
    function hashPassword(plain) {
        let h = 0x811c9dc5;
        for (let i = 0; i < plain.length; i++) {
            h ^= plain.charCodeAt(i);
            h = (h * 0x01000193) >>> 0;
        }
        return 'h_' + h.toString(36) + '_' + btoa(unescape(encodeURIComponent(plain))).slice(0, 12);
    }
    function checkPassword(plain, hash) {
        return hashPassword(plain) === hash;
    }

    return {
        KEYS,
        initialize,
        hydrateFromCloud, pushAllToCloud,
        // users
        getUsers, saveUsers, getUser, getUserByUsername, upsertUser, deleteUser,
        getCurrentUser, setCurrentUser,
        hashPassword, checkPassword,
        // sessions
        getSessions, getUserSessions, saveSession, deleteSession,
        // bodyweight
        getBodyweight, addBodyweight,
        getBodyMetrics, addBodyMetric, deleteBodyMetric,
        // settings
        getSettings, saveSettings,
        getUserSettings, saveUserSettings,
        // overrides + effective exercise
        getOverrides, getOverride, setOverride, clearOverride,
        getEffectiveExercise, getLastExerciseSession,
        // export
        exportAll, importAll
    };
})();
