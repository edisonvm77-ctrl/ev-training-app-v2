# EV Training · Guía de instalación

App de seguimiento de entrenamiento personal con tu rutina pre-cargada del Excel "EV_Entrenamiento_ene/26.xlsx".

**Almacenamiento:** Firebase Realtime Database como fuente de verdad + localStorage como caché para uso offline.

---

## ☁️ Configurar Firebase (paso obligatorio)

La app está cableada al proyecto Firebase **`ev-training-a8989`**. Debes configurar dos cosas en la consola de Firebase:

### 1. Activar Authentication anónima

1. Entra a https://console.firebase.google.com/project/ev-training-a8989/authentication
2. Click **Get started** si nunca has habilitado Auth
3. Pestaña **Sign-in method** → habilita **Anonymous**
4. Guarda

### 2. Configurar reglas de la Realtime Database

1. Entra a https://console.firebase.google.com/project/ev-training-a8989/database
2. Pestaña **Rules**
3. Pega estas reglas y publica:

```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null",
    "users": {
      "$uid": {
        ".validate": "newData.hasChildren(['id', 'username'])"
      }
    },
    "sessions": {
      "$uid": {
        "$sid": {
          ".validate": "newData.hasChildren(['id', 'date'])"
        }
      }
    }
  }
}
```

Estas reglas exigen que el cliente esté autenticado (la app firma anónimamente al iniciar) para leer/escribir.

⚠ **Si quieres reglas más estrictas** (cada usuario solo puede ver sus propios datos) necesitarás migrar de auth anónima a auth Firebase con email/password. Para una app personal/familiar, las reglas anteriores son suficientes.

### 3. (Opcional) Restringir el dominio del apiKey

En Google Cloud Console > APIs & Services > Credentials > tu API key (Browser key) > Application restrictions: añade los dominios desde donde sirves la app (GitHub Pages, Netlify, etc.) para que el apiKey solo funcione desde ahí.

---

## 🚀 Inicio rápido (modo local)

La app **funciona inmediatamente** sin necesidad de configurar nada. Solo:

1. Abre `index.html` en tu navegador (Chrome, Edge, Safari…)
2. Inicia sesión con las credenciales por defecto:
   - **Usuario:** `edison`
   - **Contraseña:** `ev2026`
3. ¡Empieza a entrenar!

> Los datos se replican automáticamente a **Firebase Realtime Database** en cuanto la app se conecta. localStorage actúa como caché para uso offline.

---

## 🔐 Seguridad

La app implementa varias defensas:

- **Validación de inputs**: usuarios alfanuméricos limitados, contraseñas 4-80 chars, rangos numéricos validados, longitud máxima en notas/nombres.
- **Escape de HTML**: todo dato dinámico (nombres de usuario, ejercicios, sesiones) se escapa antes de renderizar para prevenir XSS.
- **Validación de imágenes**: solo PNG/JPG/WebP/GIF (no SVG por seguridad), máx 4 MB, verificación del data URL.
- **CSP estricto**: meta tag `Content-Security-Policy` que solo permite scripts de jsdelivr/gstatic y conexiones a Firebase.
- **Firebase**:
  - Auth anónima obligatoria — sin token, las reglas rechazan cualquier read/write.
  - Reglas server-side validan estructura mínima de los nodos (`hasChildren`).
  - apiKey puede restringirse por dominio en Google Cloud Console.
- **Contraseñas hashed** en cliente (FNV-1a + base64). NO es criptográficamente segura — apropiada para una app personal entre amigos, no para datos sensibles.

⚠ **Notas importantes**:
- Este es un sistema de auth ligero diseñado para uso personal/familiar. NO uses la misma contraseña que para servicios sensibles.
- localStorage es accesible por cualquier script del mismo origen y por quien tenga acceso al dispositivo.
- Para reglas más estrictas (cada usuario solo ve sus datos), migra a Firebase Auth con email/password.

---

## 👥 Crear usuarios para compartir

Desde el menú lateral (icono ☰) → **Gestionar usuarios** → **Crear usuario**.

Asigna las rutinas que cada usuario podrá ver. Los usuarios "user" pueden entrenar pero no gestionar otros usuarios; los "admin" sí pueden.

Comparte:
- El link de la app (donde la hayas hospedado o el archivo)
- El usuario y contraseña que creaste

---

## 📱 Usar como app en el celular

### Android (Chrome)
1. Abre la app en Chrome
2. Menú `⋮` → **Añadir a pantalla principal**

### iPhone (Safari)
1. Abre la app en Safari
2. Botón compartir → **Añadir a inicio**

Se verá como una app nativa, sin barras del navegador.

---

## 🌐 Hospedar la app online (opcional, para compartir link)

La forma más rápida y gratuita:

### GitHub Pages
1. Crea un repo en github.com
2. Sube todos los archivos
3. Settings → Pages → Source: `main` branch → Save
4. Tu URL será `https://<tu-usuario>.github.io/<tu-repo>/`

### Netlify Drop
1. Ve a https://app.netlify.com/drop
2. Arrastra la carpeta `App_GY`
3. Te dan una URL al instante

### Vercel
Similar a Netlify, sube el zip y listo.

---

## 🧰 Estructura de archivos

```
App_GY/
├── index.html              ← Punto de entrada
├── manifest.webmanifest    ← PWA (instalable en celular)
├── css/
│   └── styles.css          ← Estilos (tema oscuro mobile-first)
└── js/
    ├── data.js             ← Tus 4 rutinas pre-cargadas
    ├── cloud.js            ← Wrapper de Firebase (auth + RTDB)
    ├── storage.js          ← Capa de persistencia (localStorage + Firebase)
    ├── auth.js             ← Login/usuarios
    ├── illustrations.js    ← Ilustraciones SVG de ejercicios
    ├── workout.js          ← Lógica de entrenamiento + cronómetro
    ├── dashboard.js        ← Estadísticas + gráficos
    └── app.js              ← Controlador principal
```

---

## 💡 Funcionalidades incluidas

- ✅ Login multi-usuario con roles (admin/user)
- ✅ 4 rutinas pre-cargadas con tus pesos del último entrenamiento
- ✅ Notas técnicas de cada ejercicio (extraídas de tu Excel)
- ✅ Cronómetro de descanso visual entre series
- ✅ Cronómetro total del entrenamiento
- ✅ Edición en vivo de peso y reps por serie
- ✅ Comparación con la sesión anterior al finalizar
- ✅ Dashboard con: volumen, frecuencia semanal, progresión por ejercicio, récords
- ✅ Historial completo de sesiones
- ✅ Export/Import JSON, Export CSV
- ✅ Sincronización automática con Firebase Realtime Database
- ✅ Funciona offline (PWA-ready)
- ✅ Diseño mobile-first

---

## 🔐 Cambia la contraseña por defecto

Después de tu primer login, ve a **Ajustes → Cambiar contraseña**.
La contraseña por defecto (`ev2026`) es solo para el setup inicial.
