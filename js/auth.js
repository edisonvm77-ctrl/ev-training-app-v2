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

    return { login, logout, isAdmin, createUser, changePassword, resetPassword, updateUser };
})();
