/**
 * Authentication: simple username/password against localStorage
 */

const Auth = (() => {
    function login(username, password) {
        const user = Storage.getUserByUsername(username);
        if (!user) return { ok: false, error: 'Usuario no encontrado' };
        if (!Storage.checkPassword(password, user.password)) {
            return { ok: false, error: 'Contraseña incorrecta' };
        }
        Storage.setCurrentUser(user.id);
        return { ok: true, user };
    }

    /**
     * Async login that, if the username isn't found locally, falls back to
     * looking up the user in Firebase. This lets new users sign in on a device
     * that hasn't synced yet (e.g. when the link is shared with a friend).
     */
    async function loginAsync(username, password) {
        const local = login(username, password);
        if (local.ok) return local;
        if (local.error !== 'Usuario no encontrado') return local;
        // Try the cloud
        if (typeof Cloud === 'undefined' || !Cloud.isReady()) return local;
        try {
            const idxSnap = await firebase.database().ref(Cloud.paths.userIndex(username)).once('value');
            const userId = idxSnap.val();
            if (!userId) return local;
            const userSnap = await firebase.database().ref(Cloud.paths.user(userId)).once('value');
            const remoteUser = userSnap.val();
            if (!remoteUser) return local;
            // Save into local cache (without re-uploading to avoid loop)
            const users = Storage.getUsers();
            const idx = users.findIndex(u => u.id === remoteUser.id);
            if (idx >= 0) users[idx] = remoteUser; else users.push(remoteUser);
            Storage.saveUsers(users);
            // Verify password
            if (!Storage.checkPassword(password, remoteUser.password)) {
                return { ok: false, error: 'Contraseña incorrecta' };
            }
            Storage.setCurrentUser(remoteUser.id);
            return { ok: true, user: remoteUser };
        } catch (e) {
            console.warn('[Auth] cloud lookup failed', e);
            return local;
        }
    }

    function logout() {
        Storage.setCurrentUser(null);
    }

    function isAdmin(user) {
        return user && user.role === 'admin';
    }

    const USERNAME_RE = /^[A-Za-z0-9_.\-]{2,40}$/;

    function createUser({ username, name, password, role = 'user', routines }) {
        if (!username || !password) return { ok: false, error: 'Datos incompletos' };
        username = String(username).trim();
        name = String(name || username).trim().slice(0, 60);
        if (!USERNAME_RE.test(username)) {
            return { ok: false, error: 'Usuario solo puede tener letras, números, "_", "." o "-"' };
        }
        if (typeof password !== 'string' || password.length < 4 || password.length > 80) {
            return { ok: false, error: 'La contraseña debe tener entre 4 y 80 caracteres' };
        }
        if (role !== 'admin' && role !== 'user') role = 'user';
        if (Storage.getUserByUsername(username)) {
            return { ok: false, error: 'Ya existe un usuario con ese nombre' };
        }
        // Only keep routine IDs that actually exist in our defined ROUTINES (whitelist)
        const validIds = new Set(ROUTINES.map(r => r.id));
        const cleanRoutines = (routines || []).filter(r => validIds.has(r));
        const newUser = {
            id: 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            username,
            name,
            password: Storage.hashPassword(password),
            role,
            routines: cleanRoutines.length ? cleanRoutines : [...validIds],
            createdAt: new Date().toISOString()
        };
        Storage.upsertUser(newUser);
        return { ok: true, user: newUser };
    }

    function changePassword(userId, oldPassword, newPassword) {
        const user = Storage.getUser(userId);
        if (!user) return { ok: false, error: 'Usuario no encontrado' };
        if (typeof newPassword !== 'string' || newPassword.length < 4 || newPassword.length > 80) {
            return { ok: false, error: 'La contraseña debe tener entre 4 y 80 caracteres' };
        }
        if (!Storage.checkPassword(oldPassword, user.password)) {
            return { ok: false, error: 'Contraseña actual incorrecta' };
        }
        user.password = Storage.hashPassword(newPassword);
        Storage.upsertUser(user);
        return { ok: true };
    }

    function resetPassword(userId, newPassword) {
        const user = Storage.getUser(userId);
        if (!user) return { ok: false, error: 'Usuario no encontrado' };
        if (typeof newPassword !== 'string' || newPassword.length < 4 || newPassword.length > 80) {
            return { ok: false, error: 'Contraseña inválida' };
        }
        user.password = Storage.hashPassword(newPassword);
        Storage.upsertUser(user);
        return { ok: true };
    }

    function updateUser(userId, updates) {
        const user = Storage.getUser(userId);
        if (!user) return { ok: false, error: 'Usuario no encontrado' };
        // Whitelist allowed fields
        const validIds = new Set(ROUTINES.map(r => r.id));
        const safe = {};
        if (updates.name != null) safe.name = String(updates.name).trim().slice(0, 60);
        if (updates.username != null) {
            const u = String(updates.username).trim();
            if (!USERNAME_RE.test(u)) return { ok: false, error: 'Usuario inválido' };
            // Avoid colliding with another user
            const other = Storage.getUserByUsername(u);
            if (other && other.id !== userId) return { ok: false, error: 'Usuario ya existe' };
            safe.username = u;
        }
        if (updates.role != null) {
            safe.role = (updates.role === 'admin' || updates.role === 'user') ? updates.role : user.role;
        }
        if (updates.password != null) safe.password = updates.password; // already hashed by caller
        if (Array.isArray(updates.routines)) {
            safe.routines = updates.routines.filter(r => validIds.has(r));
        }
        Object.assign(user, safe);
        Storage.upsertUser(user);
        return { ok: true, user };
    }

    return { login, loginAsync, logout, isAdmin, createUser, changePassword, resetPassword, updateUser };
})();
