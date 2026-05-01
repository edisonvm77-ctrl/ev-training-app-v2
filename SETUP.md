# EV Training · Guía de instalación

App de seguimiento de entrenamiento personal con tu rutina pre-cargada del Excel "EV_Entrenamiento_ene/26.xlsx".

---

## 🚀 Inicio rápido (modo local)

La app **funciona inmediatamente** sin necesidad de configurar nada. Solo:

1. Abre `index.html` en tu navegador (Chrome, Edge, Safari…)
2. Inicia sesión con las credenciales por defecto:
   - **Usuario:** `edison`
   - **Contraseña:** `ev2026`
3. ¡Empieza a entrenar!

> Los datos se guardan en `localStorage` del navegador. Si quieres acceder desde otro dispositivo o respaldar tus datos, configura la sincronización con Google Sheets (siguiente sección).

---

## ☁️ Sincronización con Google Sheets

Esto te permite:
- Acceder a tus datos desde cualquier dispositivo
- Tener un respaldo automático en la nube
- Compartir el link con otros usuarios

### Paso 1: Tu hoja de cálculo ya está creada

Se creó automáticamente en tu Drive: **EV_Training_DB**

URL: https://docs.google.com/spreadsheets/d/1Cox1uUSgmvZvYr6vFFljeU-GcizsYkOa2qp6DQjSr3E/edit

### Paso 2: Conecta el script

1. Abre la hoja **EV_Training_DB**
2. Menú **Extensiones → Apps Script**
3. Borra el código que aparece y pega el contenido de `google-apps-script/Code.gs`
4. Guarda con `Ctrl+S` y nombra el proyecto "EV Training Backend"
5. (Opcional) En la barra superior selecciona la función `setup` y pulsa **Ejecutar** una vez para crear las pestañas. Acepta los permisos cuando los pida.

### Paso 3: Genera un token de seguridad (recomendado)

⚠ Como el Web App está abierto a "Cualquier usuario", cualquiera con la URL puede escribir. Para evitarlo:

1. En el editor de Apps Script, selecciona la función **`generateToken`** y pulsa **Ejecutar**
2. Aparecerá una alerta con tu token. **Cópialo**
3. Listo, ese token queda guardado en las propiedades del proyecto

Alternativa manual: Project Settings (icono ⚙) → Script Properties → Add property → Key: `API_TOKEN`, Value: cualquier cadena larga aleatoria.

### Paso 4: Despliega como Web App

1. Click **Implementar → Nueva implementación**
2. Tipo: **Aplicación web**
3. Configura:
   - Descripción: `EV Training v1`
   - Ejecutar como: **Yo (tu correo)**
   - Quién tiene acceso: **Cualquier usuario**
4. Click **Implementar**
5. Acepta permisos
6. Copia la URL del Web App (termina en `/exec`)

### Paso 5: Pega la URL y el token en la app

1. En la app abre **Ajustes → Sincronización con Google Sheets**
2. Pega la **URL del Web App**
3. Pega el **Token de seguridad** que generaste
4. Click **Probar conexión** → debe decir "Conexión OK"
5. Click **Sincronizar ahora** → sube todo lo que tengas hasta el momento

A partir de ahí, cada sesión que guardes se sincroniza automáticamente.

---

## 🔐 Seguridad

La app implementa varias defensas:

- **Validación de inputs**: usuarios alfanuméricos limitados, contraseñas 4-80 chars, rangos numéricos validados, longitud máxima en notas/nombres.
- **Escape de HTML**: todo dato dinámico (nombres de usuario, ejercicios, sesiones) se escapa antes de renderizar para prevenir XSS.
- **Validación de imágenes**: solo PNG/JPG/WebP/GIF (no SVG por seguridad), máx 4 MB, verificación del data URL.
- **CSP estricto**: meta tag `Content-Security-Policy` que solo permite scripts de jsdelivr y conexiones a script.google.com.
- **Apps Script**:
  - Token compartido (`API_TOKEN`) validado en cada request con comparación de tiempo constante.
  - Rate limit: máximo 60 requests/minuto por usuario.
  - Lista blanca de acciones permitidas.
  - Sanitización del payload (longitudes acotadas, números validados).
  - Tamaño máximo de payload: 5 MB.
- **URL de Sheets validada**: solo se aceptan URLs HTTPS de `script.google.com`.
- **Contraseñas hashed** en localStorage (FNV-1a + base64). NO es criptográficamente segura — apropiada para una app personal entre amigos, no para datos sensibles.

⚠ **Notas importantes**:
- Este es un sistema de auth ligero diseñado para uso personal/familiar. NO uses la misma contraseña que para servicios sensibles.
- localStorage es accesible por cualquier script del mismo origen y por quien tenga acceso al dispositivo.
- Si compartes el link, cambia siempre el token tras revocar acceso a alguien.

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
├── css/
│   └── styles.css          ← Estilos (tema oscuro mobile-first)
├── js/
│   ├── data.js             ← Tus 4 rutinas pre-cargadas
│   ├── storage.js          ← Capa de persistencia
│   ├── auth.js             ← Login/usuarios
│   ├── illustrations.js    ← Ilustraciones SVG de ejercicios
│   ├── workout.js          ← Lógica de entrenamiento + cronómetro
│   ├── dashboard.js        ← Estadísticas + gráficos
│   └── app.js              ← Controlador principal
└── google-apps-script/
    └── Code.gs             ← Backend de Google Sheets
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
- ✅ Sincronización opcional con Google Sheets
- ✅ Funciona offline (PWA-ready)
- ✅ Diseño mobile-first

---

## 🔐 Cambia la contraseña por defecto

Después de tu primer login, ve a **Ajustes → Cambiar contraseña**.
La contraseña por defecto (`ev2026`) es solo para el setup inicial.
