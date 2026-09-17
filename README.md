# Sistema de Afiliados ML — GitHub + Vercel

## Cómo funciona

```
Tú editas productos.csv
        ↓
Subes el archivo a GitHub
        ↓
GitHub Actions corre automáticamente (9am, 2pm, 8pm)
        ↓
Publica en Telegram + actualiza ofertas.json
        ↓
Vercel sirve el sitio web actualizado
```

---

## Configuración inicial (una sola vez, ~20 minutos)

### Paso 1 — Subir el repo a GitHub

1. Ve a https://github.com/new
2. Crea un repositorio nuevo, ponle el nombre que quieras (Ej: `ofertas-ml`)
3. Márcalo como **Público** (necesario para Vercel gratis)
4. Sube todos estos archivos arrastrándolos, o usando Git:

```bash
git init
git add .
git commit -m "primer commit"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/ofertas-ml.git
git push -u origin main
```

---

### Paso 2 — Agregar los Secrets de GitHub

Los Secrets son variables privadas que GitHub Actions usa sin que queden expuestas en el código.

1. Ve a tu repo en GitHub
2. Haz clic en **Settings** (arriba a la derecha)
3. En el menú izquierdo: **Secrets and variables → Actions**
4. Haz clic en **New repository secret** y agrega estos tres:

| Nombre del secret | Valor |
|---|---|
| `TG_BOT_TOKEN` | El token de tu bot de Telegram (de @BotFather) |
| `TG_CHANNEL_ID` | El ID de tu canal, Ej: `@mi_canal_ofertas` |
| `TG_INTRO_MSG` | Texto opcional al inicio del mensaje, Ej: `🔥 Oferta del día:` |

> Si no tienes bot de Telegram todavía:
> 1. Abre Telegram y busca **@BotFather**
> 2. Escribe `/newbot` y sigue los pasos
> 3. Copia el token que te entrega

---

### Paso 3 — Conectar con Vercel

1. Ve a https://vercel.com y crea una cuenta (gratis)
2. Haz clic en **Add New → Project**
3. Conecta tu cuenta de GitHub y selecciona el repo `ofertas-ml`
4. Deja todo por defecto y haz clic en **Deploy**
5. En 1-2 minutos tendrás tu sitio en una URL como `ofertas-ml.vercel.app`

Vercel detectará automáticamente que es un sitio estático y lo desplegará. Cada vez que GitHub Actions actualice el `ofertas.json`, Vercel lo servirá al instante.

---

## Flujo diario (después de configurar)

### Para agregar nuevos productos:

1. Edita `productos.csv` con tus nuevos links de afiliado
2. Súbelo a GitHub (arrastra el archivo en la web de GitHub → "Commit changes")
3. **Listo.** En el próximo ciclo automático (9am, 2pm o 8pm), se publicará en Telegram y el sitio web se actualizará

### Para publicar ahora mismo (sin esperar):

1. Ve a tu repo en GitHub
2. Haz clic en **Actions** (menú superior)
3. Selecciona **"Publicar Ofertas"** en el panel izquierdo
4. Haz clic en **"Run workflow"** → **"Run workflow"**
5. En ~30 segundos estará publicado

---

## Estructura del repositorio

```
ofertas-ml/
├── .github/
│   └── workflows/
│       └── publicar.yml      ← Le dice a GitHub cuándo y cómo correr todo
├── data/
│   ├── ofertas.json          ← Generado automáticamente, lo lee el sitio web
│   └── enviados.json         ← Registro de qué ya se publicó en Telegram
├── productos.csv             ← TÚ editas este archivo con tus links
├── publicar.py               ← Script principal (no necesitas tocarlo)
├── requirements.txt          ← Dependencias Python
├── index.html                ← Sitio web (no necesitas tocarlo)
├── vercel.json               ← Configuración de Vercel (no necesitas tocarlo)
└── .gitignore
```

---

## Columnas del CSV

| Columna | Descripción | Ejemplo |
|---|---|---|
| `link_afiliado` | Tu link de MercadoLibre con tracking_id | `https://...?tracking_id=mitienda` |
| `titulo` | Nombre del producto | `Notebook HP 15 Core i5` |
| `precio_clp` | Precio actual en pesos | `399990` |
| `precio_original_clp` | Precio anterior (opcional, para mostrar descuento) | `549990` |
| `categoria` | Categoría del producto | `computacion` |
| `descripcion` | Texto corto para Telegram y web | `Ideal para trabajo` |
| `imagen` | URL de la imagen (opcional) | `https://...jpg` |
| `publicar_telegram` | si / no | `si` |
| `publicar_web` | si / no | `si` |
| `activo` | si / no (para desactivar sin borrar) | `si` |

---

## Preguntas frecuentes

**¿Se va a publicar el mismo producto dos veces en Telegram?**
No. El archivo `data/enviados.json` guarda el ID de cada producto ya publicado. Si el producto ya fue enviado, se salta.

**¿Qué pasa si agrego un producto nuevo al CSV?**
Se publicará en Telegram en el próximo ciclo automático y aparecerá en el sitio web de inmediato.

**¿Puedo cambiar los horarios de publicación?**
Sí, edita `.github/workflows/publicar.yml`. La línea `cron: '0 12,17,23 * * *'` controla los horarios (están en UTC, Chile es UTC-3).

**¿Funciona sin Telegram?**
Sí. Si no configuras los secrets de Telegram, el script igual actualiza el `ofertas.json` y el sitio web funciona normal.
