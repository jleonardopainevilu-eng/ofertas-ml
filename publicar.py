"""
publicar.py — Lee productos desde Google Sheets (CSV público) y:
  1. Genera data/ofertas.json para el sitio web (Vercel)
  2. Publica en Telegram los productos nuevos
"""

import csv
import json
import os
import time
import requests
import io
from datetime import datetime
from pathlib import Path

# ── Configuración desde GitHub Secrets ──
TG_TOKEN    = os.environ.get("TG_BOT_TOKEN", "")
TG_CHANNEL  = os.environ.get("TG_CHANNEL_ID", "")
TG_INTRO    = os.environ.get("TG_INTRO_MSG", "")
SHEETS_URL  = os.environ.get("SHEETS_CSV_URL", "")

JSON_FILE     = Path("data/ofertas.json")
ENVIADOS_FILE = Path("data/enviados.json")


def leer_productos() -> list:
    if not SHEETS_URL:
        print("[!] SHEETS_CSV_URL no configurada en los Secrets")
        return []

    print("[Sheets] Leyendo desde Google Sheets...")
    try:
        resp = requests.get(SHEETS_URL, timeout=15)
        resp.raise_for_status()
    except Exception as e:
        print(f"[!] Error al leer Sheets: {e}")
        return []

    productos = []
    reader = csv.DictReader(io.StringIO(resp.text))
    for i, row in enumerate(reader):
        link   = row.get("link_afiliado", "").strip()
        titulo = row.get("titulo", "").strip()
        if not link or not titulo:
            continue

        precio      = to_number(row.get("precio_clp", 0))
        precio_orig = to_number(row.get("precio_original_clp", 0))
        desc_pct    = round((1 - precio / precio_orig) * 100, 1) if precio_orig > precio > 0 else 0

        productos.append({
            "id":                  f"prod_{i}_{hash(link) % 99999:05d}",
            "link_afiliado":       link,
            "titulo":              titulo,
            "precio_clp":          precio,
            "precio_original_clp": precio_orig,
            "precio_fmt":          fmt_clp(precio),
            "precio_orig_fmt":     fmt_clp(precio_orig) if precio_orig else None,
            "descuento_pct":       desc_pct,
            "categoria":           row.get("categoria", "general").strip(),
            "descripcion":         row.get("descripcion", "").strip(),
            "imagen":              row.get("imagen", "").strip(),
            "publicar_telegram":   row.get("publicar_telegram", "si").strip().lower() == "si",
            "publicar_web":        row.get("publicar_web", "si").strip().lower() == "si",
            "activo":              row.get("activo", "si").strip().lower() == "si",
        })

    print(f"[Sheets] {len(productos)} productos leídos")
    return productos


def to_number(val) -> float:
    try:
        return float(str(val).replace(".", "").replace(",", ".").replace("$", "").strip())
    except:
        return 0.0


def fmt_clp(n: float) -> str:
    return "$" + f"{int(n):,}".replace(",", ".") if n else ""


def generar_json(productos: list):
    Path("data").mkdir(exist_ok=True)
    para_web = [p for p in productos if p["activo"] and p["publicar_web"]]
    with open(JSON_FILE, "w", encoding="utf-8") as f:
        json.dump({"actualizado": datetime.now().isoformat(), "total": len(para_web), "productos": para_web}, f, ensure_ascii=False, indent=2)
    print(f"[JSON] {len(para_web)} productos en {JSON_FILE}")


def cargar_enviados() -> set:
    if ENVIADOS_FILE.exists():
        with open(ENVIADOS_FILE) as f:
            return set(json.load(f))
    return set()


def guardar_enviado(pid: str, enviados: set):
    enviados.add(pid)
    with open(ENVIADOS_FILE, "w") as f:
        json.dump(list(enviados), f)


def construir_mensaje(p: dict) -> str:
    lineas = [TG_INTRO, ""] if TG_INTRO else []
    lineas.append(f"<b>{p['titulo']}</b>\n")
    precio_txt = p["precio_fmt"] + (f" <b>(-{p['descuento_pct']}%)</b>" if p["descuento_pct"] > 0 else "")
    lineas.append(f"Precio: {precio_txt}")
    if p.get("precio_orig_fmt") and p["descuento_pct"] > 0:
        lineas.append(f"Antes: <s>{p['precio_orig_fmt']}</s>")
    if p.get("descripcion"):
        lineas += ["", p["descripcion"]]
    lineas += ["", f'<a href="{p["link_afiliado"]}">Ver en MercadoLibre →</a>']
    return "\n".join(lineas)


def publicar_en_telegram(p: dict) -> bool:
    if not TG_TOKEN or not TG_CHANNEL:
        print("[TG] Sin credenciales, saltando")
        return False
    texto  = construir_mensaje(p)
    imagen = p.get("imagen", "")
    try:
        if imagen:
            url  = f"https://api.telegram.org/bot{TG_TOKEN}/sendPhoto"
            body = {"chat_id": TG_CHANNEL, "photo": imagen, "caption": texto, "parse_mode": "HTML"}
        else:
            url  = f"https://api.telegram.org/bot{TG_TOKEN}/sendMessage"
            body = {"chat_id": TG_CHANNEL, "text": texto, "parse_mode": "HTML", "disable_web_page_preview": False}
        data = requests.post(url, json=body, timeout=15).json()
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
    enviados   = cargar_enviados()
    pendientes = [p for p in productos if p["activo"] and p["publicar_telegram"] and p["id"] not in enviados]
    print(f"\n[TG] {len(pendientes)} productos nuevos para publicar")
    for p in pendientes:
        if publicar_en_telegram(p):
            guardar_enviado(p["id"], enviados)
            time.sleep(2)
    print(f"\n{'='*50}\nFin: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n{'='*50}\n")


if __name__ == "__main__":
    main()
