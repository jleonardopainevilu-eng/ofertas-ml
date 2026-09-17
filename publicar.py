"""
publicar.py — Fase 1
Lee productos desde Google Sheets (CSV público) y:
  1. Genera data/ofertas.json para el sitio web (Vercel)
  2. Publica en Telegram los productos nuevos

Compatible con las columnas antiguas y preparado para columnas nuevas:
  tienda, origen, comuna, whatsapp, destacado, plan, stock, fecha_actualizacion
"""

import csv
import hashlib
import io
import json
import os
import time
import unicodedata
from datetime import datetime
from pathlib import Path
from typing import Any

import requests

TG_TOKEN = os.environ.get("TG_BOT_TOKEN", "")
TG_CHANNEL = os.environ.get("TG_CHANNEL_ID", "")
TG_INTRO = os.environ.get("TG_INTRO_MSG", "")
SHEETS_URL = os.environ.get("SHEETS_CSV_URL", "")

JSON_FILE = Path("data/ofertas.json")
ENVIADOS_FILE = Path("data/enviados.json")

SI_VALUES = {"si", "sí", "s", "true", "1", "yes", "y", "activo", "publicar"}
NO_VALUES = {"no", "false", "0", "n", "inactivo", "pausado", "oculto"}


def get(row: dict, *keys: str, default: str = "") -> str:
    for key in keys:
        val = row.get(key)
        if val is not None and str(val).strip() != "":
            return str(val).strip()
    return default


def normalizar(txt: Any) -> str:
    texto = str(txt or "").strip().lower()
    texto = unicodedata.normalize("NFD", texto)
    texto = "".join(c for c in texto if unicodedata.category(c) != "Mn")
    return texto


def to_bool(val: Any, default: bool = True) -> bool:
    if val is None or str(val).strip() == "":
        return default
    v = normalizar(val)
    if v in SI_VALUES:
        return True
    if v in NO_VALUES:
        return False
    return default


def to_number(val: Any) -> float:
    try:
        raw = str(val or "").replace("$", "").replace(" ", "").strip()
        if not raw:
            return 0.0
        # CLP suele venir como 12.990; si además viene decimal con coma, lo respetamos.
        raw = raw.replace(".", "").replace(",", ".")
        return float(raw)
    except Exception:
        return 0.0


def fmt_clp(n: float) -> str:
    return "$" + f"{int(round(n)):,}".replace(",", ".") if n else ""


def producto_id(link: str, titulo: str) -> str:
    base = f"{link}|{titulo}".encode("utf-8")
    return "prod_" + hashlib.sha1(base).hexdigest()[:14]


def detectar_tienda(row: dict, link: str) -> str:
    tienda = get(row, "tienda", "store", "comercio", "negocio")
    if tienda:
        return tienda
    link_l = link.lower()
    if "mercadolibre" in link_l or "meli." in link_l:
        return "MercadoLibre"
    if "falabella" in link_l:
        return "Falabella"
    if "ripley" in link_l:
        return "Ripley"
    if "paris" in link_l:
        return "Paris"
    return "MercadoLibre"


def detectar_origen(row: dict, link: str, tienda: str) -> str:
    origen = normalizar(get(row, "origen", "fuente", "tipo_oferta", "pais_origen"))
    tienda_n = normalizar(tienda)
    link_l = link.lower()
    if "local" in origen or "comercio" in origen:
        return "local"
    if "mercadolibre" in origen or "marketplace" in origen:
        return "mercadolibre"
    if "mercadolibre" in tienda_n or "mercadolibre" in link_l or "meli." in link_l:
        return "mercadolibre"
    return "mercadolibre"


def leer_productos() -> list[dict]:
    if not SHEETS_URL:
        print("[!] SHEETS_CSV_URL no configurada en los Secrets")
        return []

    print("[Sheets] Leyendo desde Google Sheets...")
    try:
        resp = requests.get(SHEETS_URL, timeout=20)
        resp.raise_for_status()
    except Exception as e:
        print(f"[!] Error al leer Sheets: {e}")
        return []

    productos: list[dict] = []
    reader = csv.DictReader(io.StringIO(resp.text))
    ahora = datetime.now().isoformat()

    for row in reader:
        link = get(row, "link_afiliado", "link_oferta", "url", "link")
        titulo = get(row, "titulo", "title", "producto", "nombre")
        if not link or not titulo:
            continue

        precio = to_number(get(row, "precio_clp", "precio", "price_clp", "price"))
        precio_orig = to_number(get(row, "precio_original_clp", "precio_orig_clp", "precio_anterior", "precio_original", "compare_at_price"))
        desc_pct = round((1 - precio / precio_orig) * 100, 1) if precio_orig > precio > 0 else to_number(get(row, "descuento_pct", "descuento"))
        tienda = detectar_tienda(row, link)
        origen = detectar_origen(row, link, tienda)
        destacado = to_bool(get(row, "destacado", "premium", "membresia", "miembro"), default=False)

        producto = {
            "id": producto_id(link, titulo),
            "link_afiliado": link,
            "link_oferta": get(row, "link_oferta", "url", default=link),
            "titulo": titulo,
            "precio_clp": precio,
            "precio_original_clp": precio_orig,
            "precio_fmt": fmt_clp(precio),
            "precio_orig_fmt": fmt_clp(precio_orig) if precio_orig else None,
            "descuento_pct": desc_pct,
            "categoria": get(row, "categoria", "category", default="general"),
            "descripcion": get(row, "descripcion", "description"),
            "imagen": get(row, "imagen", "image", "image_url", "foto"),
            "tienda": tienda,
            "origen": origen,
            "comuna": get(row, "comuna", "ciudad", "zona", "ubicacion"),
            "region": get(row, "region"),
            "whatsapp": get(row, "whatsapp", "telefono", "contacto"),
            "instagram": get(row, "instagram"),
            "plan": get(row, "plan", "tipo_plan"),
            "destacado": "si" if destacado else "no",
            "stock": get(row, "stock"),
            "votos": int(to_number(get(row, "votos", "likes", "puntos"))),
            "actualizado": get(row, "fecha_actualizacion", "actualizado", "fecha", default=ahora),
            "publicar_telegram": to_bool(get(row, "publicar_telegram"), default=True),
            "publicar_web": to_bool(get(row, "publicar_web"), default=True),
            "activo": to_bool(get(row, "activo"), default=True),
        }
        productos.append(producto)

    print(f"[Sheets] {len(productos)} productos leídos")
    return productos


def generar_json(productos: list[dict]):
    Path("data").mkdir(exist_ok=True)
    para_web = [p for p in productos if p["activo"] and p["publicar_web"]]
    payload = {
        "actualizado": datetime.now().isoformat(),
        "total": len(para_web),
        "productos": para_web,
    }
    JSON_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[JSON] {len(para_web)} productos en {JSON_FILE}")


def cargar_enviados() -> set[str]:
    if ENVIADOS_FILE.exists():
        try:
            return set(json.loads(ENVIADOS_FILE.read_text(encoding="utf-8")))
        except Exception:
            return set()
    return set()


def guardar_enviado(pid: str, enviados: set[str]):
    enviados.add(pid)
    ENVIADOS_FILE.write_text(json.dumps(sorted(enviados), ensure_ascii=False, indent=2), encoding="utf-8")


def construir_mensaje(p: dict) -> str:
    lineas = [TG_INTRO, ""] if TG_INTRO else []
    lineas.append(f"<b>{p['titulo']}</b>\n")
    precio_txt = p.get("precio_fmt", "") + (f" <b>(-{p['descuento_pct']}%)</b>" if float(p.get("descuento_pct") or 0) > 0 else "")
    lineas.append(f"Precio: {precio_txt}")
    if p.get("precio_orig_fmt") and float(p.get("descuento_pct") or 0) > 0:
        lineas.append(f"Antes: <s>{p['precio_orig_fmt']}</s>")
    if p.get("tienda"):
        lineas.append(f"Tienda: {p['tienda']}")
    if p.get("comuna"):
        lineas.append(f"Zona: {p['comuna']}")
    if p.get("descripcion"):
        lineas += ["", p["descripcion"]]
    texto_link = "Ver en MercadoLibre →" if p.get("origen") == "mercadolibre" else "Contactar tienda →"
    lineas += ["", f'<a href="{p["link_afiliado"]}">{texto_link}</a>']
    return "\n".join(lineas)


def publicar_en_telegram(p: dict) -> bool:
    if not TG_TOKEN or not TG_CHANNEL:
        print("[TG] Sin credenciales, saltando")
        return False
    texto = construir_mensaje(p)
    imagen = p.get("imagen", "")
    try:
        if imagen:
            url = f"https://api.telegram.org/bot{TG_TOKEN}/sendPhoto"
            body = {"chat_id": TG_CHANNEL, "photo": imagen, "caption": texto, "parse_mode": "HTML"}
        else:
            url = f"https://api.telegram.org/bot{TG_TOKEN}/sendMessage"
            body = {"chat_id": TG_CHANNEL, "text": texto, "parse_mode": "HTML", "disable_web_page_preview": False}
        data = requests.post(url, json=body, timeout=20).json()
        if data.get("ok"):
            print(f"[TG] ✓ {p['titulo'][:55]}")
            return True
        print(f"[TG] ✗ {data.get('description')}")
        return False
    except Exception as e:
        print(f"[TG] ✗ {e}")
        return False


def main():
    print(f"\n{'='*50}\nInicio: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n{'='*50}\n")
    productos = leer_productos()
    if not productos:
        return
    generar_json(productos)
    enviados = cargar_enviados()
    pendientes = [p for p in productos if p["activo"] and p["publicar_telegram"] and p["id"] not in enviados]
    print(f"\n[TG] {len(pendientes)} productos nuevos para publicar")
    for p in pendientes:
        if publicar_en_telegram(p):
            guardar_enviado(p["id"], enviados)
            time.sleep(2)
    print(f"\n{'='*50}\nFin: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n{'='*50}\n")


if __name__ == "__main__":
    main()
