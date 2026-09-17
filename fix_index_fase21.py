from pathlib import Path
import re

p = Path("index.html")
s = p.read_text(encoding="utf-8")

s = re.sub(
    r'<h2 class="right-title">.*?</h2>',
    '<h2 class="right-title"><span>Publica tu tienda.</span> Llega a mas clientes.</h2>',
    s,
    count=1,
    flags=re.S
)

s = re.sub(
    r'<p class="right-copy">.*?</p>',
    '<p class="right-copy">Planes desde $9.990 para tiendas de mascotas. Publica ofertas, muestra WhatsApp y destaca tu negocio local. MercadoLibre queda como referencia online mientras sumamos comercios.</p>',
    s,
    count=1,
    flags=re.S
)

if 'id="planes"' not in s:
    sec = (
        '<section class="business-box" id="planes">'
        '<div><h2>Planes para tiendas</h2>'
        '<p><strong>Fundadores</strong> - $9.990/mes<br>'
        '<strong>Vitrina Local</strong> - $19.990 + IVA<br>'
        '<strong>Impulso Comercial</strong> - $39.990 + IVA</p></div>'
        '<a class="btn btn-blue" href="#marcas">Consultar membresia</a>'
        '</section>\n\n    '
    )
    s = s.replace('<section class="business-box" id="marcas">', sec + '<section class="business-box" id="marcas">', 1)

p.write_text(s, encoding="utf-8")
