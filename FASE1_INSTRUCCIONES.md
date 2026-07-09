# El Ofertón del Gatito — Fase 1

Objetivo: conservar MercadoLibre/Sheets como base y preparar Supabase para comercio local, membresías y administración futura.

## Archivos modificados

- `index.html`: preparado para leer MercadoLibre desde `/data/ofertas.json` y comercio local desde Supabase si `config.supabase.js` tiene datos.
- `publicar.py`: compatible con columnas antiguas y nuevas de Sheets.
- `supabase_schema.sql`: tablas, vistas, índices y políticas RLS para Supabase.
- `config.supabase.js`: archivo de configuración pública; puede quedar vacío al inicio.

## Sheets sigue funcionando

Columnas mínimas antiguas:

```txt
link_afiliado
titulo
precio_clp
precio_original_clp
categoria
descripcion
imagen
publicar_telegram
publicar_web
activo
```

Columnas nuevas recomendadas:

```txt
tienda
origen
comuna
region
whatsapp
instagram
destacado
plan
stock
votos
fecha_actualizacion
```

Para MercadoLibre usa:

```txt
origen = mercadolibre
tienda = MercadoLibre
```

## Supabase

1. Crear proyecto en Supabase.
2. Abrir SQL Editor.
3. Pegar y ejecutar `supabase_schema.sql`.
4. Copiar Project URL y anon public key.
5. Editar `config.supabase.js`:

```js
window.GATITO_SUPABASE = {
  url: "https://TU-PROYECTO.supabase.co",
  anonKey: "TU_ANON_PUBLIC_KEY"
};
```

Con valores vacíos, el sitio no se rompe: sigue usando solo Sheets/JSON.

## Próxima fase

- Crear `admin.html` móvil para administrar tiendas, productos y leads sin entrar al panel de Supabase.
- Conectar clics y votos reales a Supabase.
- Crear reportes mensuales para comercios miembros.
