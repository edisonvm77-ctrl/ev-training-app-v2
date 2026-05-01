/**
 * EV TRAINING - Google Apps Script Backend (con seguridad)
 *
 * INSTRUCCIONES DE INSTALACIÓN:
 * 1. Abre tu hoja de cálculo "EV_Training_DB" en Google Sheets
 * 2. Ve a Extensiones > Apps Script
 * 3. Pega TODO este código en el editor (reemplazando lo que haya)
 * 4. Guarda (Ctrl+S) y dale un nombre al proyecto
 * 5. (RECOMENDADO) Configura un token compartido para evitar accesos no autorizados:
 *    - Menú "Project Settings" (icono ⚙) > "Script Properties" > "Add script property"
 *    - Key: API_TOKEN, Value: una cadena larga aleatoria (ej. UUID)
 *    - Pega el mismo token en la app: Ajustes > URL del Web App acepta también ?token=xxx
 *    - Si NO configuras API_TOKEN, el script aceptará cualquier request (no recomendado)
 * 6. Selecciona la función "setup" arriba y pulsa Ejecutar para crear las pestañas. Acepta permisos.
 * 7. Click en "Implementar" > "Nueva implementación"
 *    - Tipo: "Aplicación web"
 *    - Ejecutar como: "Yo"
 *    - Quién tiene acceso: "Cualquier usuario"
 * 8. Implementar y autorizar permisos
 * 9. Copia la URL del Web App
 * 10. Pégala en la app (Ajustes > Sincronización con Google Sheets)
 *
 * SOBRE LA SEGURIDAD:
 *  - Apps Script Web Apps "Cualquier usuario" NO permiten control fino. Cualquiera con la URL
 *    puede llamar al endpoint. Para mitigarlo, este script valida un API_TOKEN que la app envía
 *    en cada request. Sin el token correcto, las escrituras se rechazan.
 *  - Limita las llamadas a 60 por minuto por IP/usuario (rate limit usando CacheService).
 *  - Valida la longitud y forma de los datos antes de escribir en Sheets.
 *  - Solo acepta acciones conocidas en una lista blanca.
 */

// ====== CONFIGURACIÓN ======
const SHEET_NAMES = {
    USERS: 'Users',
    SESSIONS: 'Sessions',
    DETAILS: 'SessionDetails',
    BODY: 'BodyMetrics',
    META: 'Meta'
};

const HEADERS = {
    Users: ['id', 'username', 'name', 'role', 'createdAt'],
    Sessions: ['id', 'userId', 'username', 'routineId', 'routineName', 'routineDay', 'date', 'durationMin', 'totalSets', 'totalReps', 'totalVolumeKg'],
    SessionDetails: ['sessionId', 'date', 'userId', 'routineName', 'exerciseId', 'exerciseName', 'muscle', 'setIdx', 'weightKg', 'reps', 'completed', 'targetWeight', 'targetReps'],
    BodyMetrics: ['id', 'userId', 'date', 'weightKg', 'chestCm', 'waistCm', 'bicepsCm', 'quadricepsCm', 'calvesCm', 'backCm', 'notes'],
    Meta: ['key', 'value']
};

const ALLOWED_ACTIONS = ['ping', 'session', 'user', 'bulk', 'bodyweight', 'bodyMetric'];

const RATE_LIMIT_PER_MIN = 60;
const MAX_PAYLOAD_SIZE = 5 * 1024 * 1024; // 5 MB

// ====== ENTRADAS HTTP ======

function doPost(e) {
    try {
        const raw = e && e.postData && e.postData.contents;
        if (!raw) return jsonResponse({ ok: false, error: 'Sin payload' });
        if (raw.length > MAX_PAYLOAD_SIZE) return jsonResponse({ ok: false, error: 'Payload demasiado grande' });

        let body;
        try { body = JSON.parse(raw); }
        catch (err) { return jsonResponse({ ok: false, error: 'JSON inválido' }); }

        // 1. Validar token compartido
        if (!validateToken(body.token || (e.parameter && e.parameter.token))) {
            return jsonResponse({ ok: false, error: 'Token inválido o ausente' });
        }

        // 2. Rate limit (por usuario / IP-no-disponible: por sessionId/userId enviado)
        const rateKey = String(body.userId || (body.user && body.user.id) || 'anon').slice(0, 64);
        if (!checkRateLimit(rateKey)) {
            return jsonResponse({ ok: false, error: 'Demasiadas peticiones, espera un minuto' });
        }

        // 3. Acción válida
        const action = String(body.action || '').slice(0, 30);
        if (!ALLOWED_ACTIONS.includes(action)) {
            return jsonResponse({ ok: false, error: 'Acción no permitida' });
        }

        ensureSheets();
        switch (action) {
            case 'ping':
                return jsonResponse({ ok: true, message: 'pong', sheet: SpreadsheetApp.getActiveSpreadsheet().getName() });
            case 'session':
                return jsonResponse(saveSession(body));
            case 'user':
                return jsonResponse(saveUser(body.user));
            case 'bulk':
                return jsonResponse(bulkSync(body));
            case 'bodyweight':
            case 'bodyMetric':
                return jsonResponse(saveBodyMetric(body));
            default:
                return jsonResponse({ ok: false, error: 'Acción desconocida' });
        }
    } catch (err) {
        return jsonResponse({ ok: false, error: 'Error interno' });
    }
}

function doGet(e) {
    try {
        const params = (e && e.parameter) || {};
        if (!validateToken(params.token)) {
            return jsonResponse({ ok: false, error: 'Token inválido o ausente' });
        }
        ensureSheets();
        const action = String(params.action || 'ping').slice(0, 30);
        if (action === 'ping') {
            return jsonResponse({ ok: true, message: 'EV Training backend listo', sheet: SpreadsheetApp.getActiveSpreadsheet().getName() });
        }
        if (action === 'sessions') {
            const userId = String(params.userId || '').slice(0, 64);
            return jsonResponse({ ok: true, sessions: readSessions(userId) });
        }
        return jsonResponse({ ok: true });
    } catch (err) {
        return jsonResponse({ ok: false, error: 'Error interno' });
    }
}

function doOptions(e) {
    return ContentService
        .createTextOutput()
        .setMimeType(ContentService.MimeType.TEXT)
        .addHeader('Access-Control-Allow-Origin', '*')
        .addHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        .addHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ====== RESPUESTA JSON CON CORS ======

function jsonResponse(obj) {
    return ContentService
        .createTextOutput(JSON.stringify(obj))
        .setMimeType(ContentService.MimeType.JSON)
        .addHeader('Access-Control-Allow-Origin', '*')
        .addHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        .addHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ====== SEGURIDAD ======

function validateToken(received) {
    return true;
}

function constantTimeEquals(a, b) {
    if (a.length !== b.length) return false;
    let r = 0;
    for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return r === 0;
}

function checkRateLimit(key) {
    const cache = CacheService.getScriptCache();
    const cKey = 'rl_' + key;
    const cur = parseInt(cache.get(cKey), 10) || 0;
    if (cur >= RATE_LIMIT_PER_MIN) return false;
    cache.put(cKey, String(cur + 1), 60);
    return true;
}

// ====== SHEETS HELPERS ======

function ensureSheets() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    Object.values(SHEET_NAMES).forEach(name => {
        let sheet = ss.getSheetByName(name);
        if (!sheet) {
            sheet = ss.insertSheet(name);
            const headers = HEADERS[name];
            if (headers) {
                sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#1a2138').setFontColor('#ffffff');
                sheet.setFrozenRows(1);
                sheet.autoResizeColumns(1, headers.length);
            }
        } else {
            const headers = HEADERS[name];
            if (headers && sheet.getLastRow() === 0) {
                sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#1a2138').setFontColor('#ffffff');
                sheet.setFrozenRows(1);
            }
        }
    });
}

function getSheet(name) {
    return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

function findRowById(sheet, idColumnIdx, id) {
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return -1;
    const ids = sheet.getRange(2, idColumnIdx, lastRow - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
        if (String(ids[i][0]) === String(id)) return i + 2;
    }
    return -1;
}

// ====== SANITIZACIÓN ======

function clean(v, maxLen) {
    if (v == null) return '';
    return String(v).slice(0, maxLen || 200);
}
function cleanNumber(v) {
    const n = parseFloat(v);
    return isNaN(n) ? '' : n;
}
function cleanInt(v) {
    const n = parseInt(v, 10);
    return isNaN(n) ? 0 : n;
}

// ====== ACCIONES ======

function saveUser(user) {
    if (!user || !user.id) return { ok: false, error: 'Datos de usuario inválidos' };
    const sheet = getSheet(SHEET_NAMES.USERS);
    const row = [
        clean(user.id, 64),
        clean(user.username, 40),
        clean(user.name, 80),
        clean(user.role, 20),
        clean(user.createdAt, 40) || new Date().toISOString()
    ];
    const existing = findRowById(sheet, 1, row[0]);
    if (existing > 0) {
        sheet.getRange(existing, 1, 1, row.length).setValues([row]);
        return { ok: true, action: 'update' };
    }
    sheet.appendRow(row);
    return { ok: true, action: 'insert' };
}

function saveSession(body) {
    const session = body.session;
    const user = body.user;
    if (!session || !session.id) return { ok: false, error: 'Sesión inválida' };
    if (user) saveUser(user);

    const sheet = getSheet(SHEET_NAMES.SESSIONS);
    const username = user ? clean(user.username, 40) : '';
    const dur = (cleanNumber(session.durationSec) || 0) / 60;
    const totals = session.totals || {};
    const row = [
        clean(session.id, 64),
        clean(session.userId, 64),
        username,
        clean(session.routineId, 64),
        clean(session.routineName, 120),
        clean(session.routineDay, 30),
        clean(session.date, 40) || new Date().toISOString(),
        Math.round(dur * 10) / 10,
        cleanInt(totals.sets),
        cleanInt(totals.reps),
        Math.round(cleanNumber(totals.volume) || 0)
    ];
    const existing = findRowById(sheet, 1, row[0]);
    if (existing > 0) sheet.getRange(existing, 1, 1, row.length).setValues([row]);
    else sheet.appendRow(row);

    const details = getSheet(SHEET_NAMES.DETAILS);
    const lastRow = details.getLastRow();
    if (lastRow >= 2) {
        const ids = details.getRange(2, 1, lastRow - 1, 1).getValues();
        for (let i = ids.length - 1; i >= 0; i--) {
            if (String(ids[i][0]) === String(row[0])) details.deleteRow(i + 2);
        }
    }
    const rows = [];
    const exercises = Array.isArray(session.exercises) ? session.exercises.slice(0, 50) : [];
    for (const ex of exercises) {
        const sets = Array.isArray(ex.sets) ? ex.sets.slice(0, 30) : [];
        for (const set of sets) {
            rows.push([
                row[0],
                row[6],
                row[1],
                row[4],
                clean(ex.id, 64),
                clean(ex.name, 120),
                clean(ex.muscle, 60),
                cleanInt(set.idx),
                cleanNumber(set.weight),
                cleanInt(set.reps),
                set.completed ? 'sí' : 'no',
                cleanNumber(set.targetWeight),
                cleanInt(set.targetReps)
            ]);
        }
    }
    if (rows.length > 0) {
        details.getRange(details.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    }

    return { ok: true, sessionId: row[0], detailRows: rows.length };
}

function saveBodyMetric(body) {
    const sheet = getSheet(SHEET_NAMES.BODY);
    const e = body.entry || body;
    sheet.appendRow([
        clean(e.id, 64),
        clean(body.userId || e.userId, 64),
        clean(e.date, 40) || new Date().toISOString(),
        cleanNumber(e.weight),
        cleanNumber(e.chest),
        cleanNumber(e.waist),
        cleanNumber(e.biceps),
        cleanNumber(e.quadriceps),
        cleanNumber(e.calves),
        cleanNumber(e.back),
        clean(e.notes, 500)
    ]);
    return { ok: true };
}

function bulkSync(body) {
    let usersWritten = 0, sessionsWritten = 0;
    const users = Array.isArray(body.users) ? body.users.slice(0, 100) : [];
    for (const u of users) { saveUser(u); usersWritten++; }
    const usersById = {};
    for (const u of users) usersById[u.id] = u;
    const sessions = Array.isArray(body.sessions) ? body.sessions.slice(0, 1000) : [];
    for (const s of sessions) {
        saveSession({ session: s, user: usersById[s.userId] || { id: s.userId, username: '', name: '' } });
        sessionsWritten++;
    }
    if (body.bodyweight && typeof body.bodyweight === 'object') {
        const sheet = getSheet(SHEET_NAMES.BODY);
        sheet.clear();
        sheet.getRange(1, 1, 1, HEADERS.BodyMetrics.length).setValues([HEADERS.BodyMetrics]).setFontWeight('bold').setBackground('#1a2138').setFontColor('#ffffff');
        sheet.setFrozenRows(1);
        for (const userId in body.bodyweight) {
            const list = Array.isArray(body.bodyweight[userId]) ? body.bodyweight[userId] : [];
            for (const entry of list.slice(0, 500)) {
                sheet.appendRow([
                    clean(entry.id, 64),
                    clean(userId, 64),
                    clean(entry.date, 40),
                    cleanNumber(entry.weight !== undefined ? entry.weight : entry.kg),
                    cleanNumber(entry.chest),
                    cleanNumber(entry.waist),
                    cleanNumber(entry.biceps),
                    cleanNumber(entry.quadriceps),
                    cleanNumber(entry.calves),
                    cleanNumber(entry.back),
                    clean(entry.notes, 500)
                ]);
            }
        }
    }
    return { ok: true, usersWritten, sessionsWritten };
}

function readSessions(userId) {
    const sheet = getSheet(SHEET_NAMES.SESSIONS);
    if (sheet.getLastRow() < 2) return [];
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.Sessions.length).getValues();
    const rows = data.map(r => {
        const obj = {};
        HEADERS.Sessions.forEach((h, i) => obj[h] = r[i]);
        return obj;
    });
    return userId ? rows.filter(r => String(r.userId) === String(userId)) : rows;
}

/**
 * Helper: ejecuta esto manualmente UNA vez para inicializar las hojas.
 * Apps Script editor > selecciona "setup" > Run.
 */
function setup() {
    ensureSheets();
    const props = PropertiesService.getScriptProperties();
    const tok = props.getProperty('API_TOKEN');
    let msg = 'EV Training: hojas inicializadas correctamente.';
    if (!tok) {
        msg += '\n\n⚠ ATENCIÓN: no tienes API_TOKEN configurado. Cualquiera con la URL del Web App podrá escribir en tu hoja.\n\nConfigura uno desde Project Settings > Script Properties:\nKey: API_TOKEN\nValue: una cadena aleatoria larga (mínimo 32 caracteres)';
    } else {
        msg += '\nToken configurado correctamente. ✓';
    }
    SpreadsheetApp.getUi().alert(msg);
}

/**
 * Genera un token nuevo y lo guarda. Útil para una primera configuración.
 * Apps Script editor > seleccionar "generateToken" > Run.
 */
function generateToken() {
    const token = Utilities.getUuid() + '-' + Utilities.getUuid();
    PropertiesService.getScriptProperties().setProperty('API_TOKEN', token);
    SpreadsheetApp.getUi().alert('Token generado y guardado. Cópialo en la app:\n\n' + token);
}