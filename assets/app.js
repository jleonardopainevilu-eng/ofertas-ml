let TODOS = [];
    let filtroDescuento = false;

    const SUPABASE_CONFIG = window.GATITO_SUPABASE || {};
    const SUPABASE_URL = String(SUPABASE_CONFIG.url || "").replace(/\/$/, "");
    const SUPABASE_ANON_KEY = String(SUPABASE_CONFIG.anonKey || "");
    const SUPABASE_ACTIVO = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

    function supabaseHeaders() {
      return {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json"
      };
    }

    const fmtCLP = (n) => "$" + Math.round(Number(n || 0)).toLocaleString("es-CL");

    function repararTexto(valor) {
      let texto = String(valor ?? "");
      if (!texto) return "";

      if (/[ÃÂ]/.test(texto)) {
        try {
          texto = decodeURIComponent(escape(texto));
        } catch (e) {}
      }

      return texto
        .replaceAll("â€“", "-")
        .replaceAll("â€”", "-")
        .replaceAll("â†’", "->")
        .replaceAll("Â ", " ")
        .replaceAll("Â", "")
        .trim();
    }

    function escaparHTML(texto) {
      return repararTexto(texto)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function normalizar(texto) {
      return repararTexto(texto)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
    }

    function detectarTienda(p) {
      const directa = repararTexto(p.tienda || p.store || p.comercio || p.negocio || "");
      if (directa) return directa;

      const link = String(p.link_afiliado || p.link_oferta || "").toLowerCase();

      if (link.includes("mercadolibre") || link.includes("meli.")) return "MercadoLibre";
      if (link.includes("falabella")) return "Falabella";
      if (link.includes("ripley")) return "Ripley";
      if (link.includes("paris")) return "Paris";
      if (link.includes("aliexpress")) return "AliExpress";
      if (link.includes("amazon")) return "Amazon";
      if (link.includes("shopee")) return "Shopee";

      return "Comercio local";
    }

    function detectarOrigen(p) {
      const tipo = normalizar(p.tipo_oferta || p.origen || p.pais_origen || p.fuente || "");
      const tienda = normalizar(detectarTienda(p));
      const link = String(p.link_afiliado || p.link_oferta || "").toLowerCase();

      if (
        tipo.includes("local") ||
        tipo.includes("comercio") ||
        tipo.includes("tienda local") ||
        tienda.includes("local") ||
        tienda.includes("veterinaria") ||
        tienda.includes("peluqueria") ||
        tienda.includes("petshop")
      ) {
        return "local";
      }

      if (
        tipo.includes("mercadolibre") ||
        tipo.includes("marketplace") ||
        tienda.includes("mercadolibre") ||
        link.includes("mercadolibre") ||
        link.includes("meli.")
      ) {
        return "mercadolibre";
      }

      return "local";
    }

    function categoriaBonita(cat) {
      const c = normalizar(cat || "general");

      const mapa = {
        alimento: "Alimento",
        alimentos: "Alimentos",
        comida: "Comida",
        snacks: "Snacks",
        premios: "Premios",
        juguetes: "Juguetes",
        accesorios: "Accesorios",
        camas: "Camas",
        higiene: "Higiene",
        arena: "Arena",
        salud: "Salud y cuidado",
        cuidado: "Cuidado",
        peluqueria: "Peluquería",
        veterinaria: "Veterinaria",
        paseos: "Paseos",
        servicios: "Servicios",
        ropa: "Ropa",
        transporte: "Transporte",
        general: "General"
      };

      return mapa[c] || repararTexto(cat || "General");
    }

    function esDestacadoMiembro(p) {
      const valores = [
        p.destacado,
        p.premium,
        p.membresia,
        p.miembro,
        p.plan,
        p.tipo_publicacion
      ].map(v => normalizar(v || ""));

      return valores.some(v =>
        v === "si" ||
        v === "sí" ||
        v.includes("premium") ||
        v.includes("destacado") ||
        v.includes("membresia") ||
        v.includes("miembro") ||
        v.includes("pro")
      );
    }

    function tiempoRelativo(fecha) {
      if (!fecha || isNaN(fecha.getTime())) return "Actualizado recientemente";
      const diff = Date.now() - fecha.getTime();
      const mins = Math.max(0, Math.round(diff / 60000));
      if (mins < 2) return "Actualizado recién";
      if (mins < 60) return `Actualizado hace ${mins} min`;
      const horas = Math.round(mins / 60);
      if (horas < 24) return `Actualizado hace ${horas} h`;
      const dias = Math.round(horas / 24);
      return `Actualizado hace ${dias} día${dias === 1 ? "" : "s"}`;
    }

    function claveOferta(p) {
      return "voto_" + btoa(unescape(encodeURIComponent(String(p.link_afiliado || p.link_oferta || p.titulo || "oferta")))).slice(0, 28);
    }

    function votosOferta(p) {
      const base = Number(p.votos || p.likes || p.puntos || 0);
      const extra = localStorage.getItem(claveOferta(p)) ? 1 : 0;
      return base + extra;
    }

    function yaVote(p) {
      return Boolean(localStorage.getItem(claveOferta(p)));
    }

    function votarOfertaDesdeBoton(btn, clave) {
      const actual = localStorage.getItem(clave);
      if (actual) {
        localStorage.removeItem(clave);
        btn.classList.remove("voted");
      } else {
        localStorage.setItem(clave, "1");
        btn.classList.add("voted");
      }
      const count = document.querySelector(`[data-vote-count="${clave}"]`);
      if (count) {
        const base = Number(count.getAttribute("data-base") || 0);
        count.textContent = base + (localStorage.getItem(clave) ? 1 : 0);
      }
    }

    function abrirModalPedido() {
      const modal = document.getElementById("pedido-modal");
      if (modal) modal.classList.add("open");
    }

    function cerrarModalPedido() {
      const modal = document.getElementById("pedido-modal");
      if (modal) modal.classList.remove("open");
    }

    function enviarWhatsAppPedido(producto, comuna, mascota, detalle) {
      const msg = `Hola, quiero pedir que busquen una oferta.%0AProducto: ${encodeURIComponent(producto || "")} %0AComuna: ${encodeURIComponent(comuna || "")} %0AMascota: ${encodeURIComponent(mascota || "")} %0ADetalle: ${encodeURIComponent(detalle || "")}`;
      window.open(`https://wa.me/56973806218?text=${msg}`, "_blank", "noopener");
    }

    async function enviarPedidoRapido(event) {
      event.preventDefault();
      const producto = document.getElementById("pedido-producto").value.trim();
      const comuna = document.getElementById("pedido-comuna").value.trim();
      await guardarLeadSupabase("pedido_producto", { producto, comuna, mensaje: "Pedido rápido desde la web" });
      enviarWhatsAppPedido(producto, comuna, "", "");
    }

    async function enviarPedidoModal(event) {
      event.preventDefault();
      const producto = document.getElementById("modal-producto").value.trim();
      const comuna = document.getElementById("modal-comuna").value.trim();
      const mascota = document.getElementById("modal-mascota").value.trim();
      const detalle = document.getElementById("modal-detalle").value.trim();
      await guardarLeadSupabase("pedido_producto", { producto, comuna, mascota, mensaje: detalle });
      enviarWhatsAppPedido(producto, comuna, mascota, detalle);
      cerrarModalPedido();
    }

    function registrarClic(tituloProducto) {
      // Placeholder de tracking: reemplaza esto por tu Analytics/Plausible/endpoint propio
      // cuando quieras medir qué ofertas generan más clics.
      try {
        if (window.gtag) {
          gtag("event", "click_oferta", { producto: tituloProducto });
        }
      } catch (e) {}
    }


    function abrirOferta(event, link, tituloProducto, origen) {
      registrarClic(tituloProducto);

      // Importante: no forzamos window.location ni esquemas mercadolibre://.
      // El enlace debe quedar como <a> normal para conservar el tracking afiliado
      // y permitir que Android/iOS decidan si abren la app o el navegador.
      return true;
    }

    function actualizarJSONLD() {
      const items = TODOS.slice(0, 30).map((p, i) => {
        const titulo = repararTexto(p.titulo || "Producto sin título");
        const imagen = String(p.imagen || "").trim();
        const link = String(p.link_afiliado || p.link_oferta || "").trim();
        const precio = Number(p.precio_clp || 0);

        return {
          "@type": "ListItem",
          "position": i + 1,
          "item": {
            "@type": "Product",
            "name": titulo,
            "image": imagen || undefined,
            "offers": {
              "@type": "Offer",
              "priceCurrency": "CLP",
              "price": precio || undefined,
              "url": link || undefined,
              "availability": "https://schema.org/InStock"
            }
          }
        };
      });

      const jsonLD = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "itemListElement": items
      };

      let script = document.getElementById("jsonld-ofertas");
      if (!script) {
        script = document.createElement("script");
        script.type = "application/ld+json";
        script.id = "jsonld-ofertas";
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(jsonLD);
    }

    async function cargarOfertasMercadoLibre() {
      try {
        const resp = await fetch("/data/ofertas.json", { cache: "no-store" });
        if (!resp.ok) throw new Error("No se pudo cargar /data/ofertas.json");
        const data = await resp.json();
        const productos = Array.isArray(data.productos) ? data.productos : [];
        const normalizados = productos.map(p => ({
          ...p,
          origen: p.origen || "mercadolibre",
          tienda: p.tienda || "MercadoLibre",
          fuente_datos: "sheets",
          actualizado: p.actualizado || data.actualizado
        }));
        return { productos: normalizados, actualizado: data.actualizado || new Date().toISOString(), ok: true };
      } catch (error) {
        console.warn("[MercadoLibre/JSON]", error);
        return { productos: [], actualizado: null, ok: false };
      }
    }

    function whatsappLink(numero, mensaje) {
      const limpio = String(numero || "").replace(/[^0-9]/g, "");
      if (!limpio) return "#marcas";
      return `https://wa.me/${limpio}?text=${encodeURIComponent(mensaje || "Hola, vengo desde El Ofertón del Gatito y quiero consultar por este producto.")}`;
    }

    function normalizarProductoSupabase(p) {
      const tienda = p.tienda || p.store_name || p.store?.name || p.stores?.name || "Comercio local";
      const whatsapp = p.whatsapp || p.store_whatsapp || p.store?.whatsapp || p.stores?.whatsapp || "";
      const precio = Number(p.precio_clp || p.price_clp || p.price || 0);
      const precioOriginal = Number(p.precio_original_clp || p.compare_at_price_clp || p.old_price_clp || 0);
      const descuento = precioOriginal > precio && precio > 0 ? Math.round((1 - precio / precioOriginal) * 1000) / 10 : Number(p.descuento_pct || 0);
      const titulo = p.titulo || p.title || "Producto local";
      return {
        id: p.id || `local_${titulo}_${tienda}`,
        titulo,
        descripcion: p.descripcion || p.description || "",
        precio_clp: precio,
        precio_original_clp: precioOriginal,
        precio_fmt: p.precio_fmt || fmtCLP(precio),
        precio_orig_fmt: p.precio_orig_fmt || (precioOriginal ? fmtCLP(precioOriginal) : null),
        descuento_pct: descuento,
        categoria: p.categoria || p.category || "general",
        imagen: p.imagen || p.image_url || p.photo_url || "",
        link_oferta: p.link_oferta || p.url || whatsappLink(whatsapp, `Hola, vi ${titulo} en El Ofertón del Gatito y quiero consultar.`),
        link_afiliado: p.link_afiliado || p.link_oferta || p.url || whatsappLink(whatsapp, `Hola, vi ${titulo} en El Ofertón del Gatito y quiero consultar.`),
        tienda,
        whatsapp,
        comuna: p.comuna || p.city || p.store_city || p.store?.comuna || p.stores?.comuna || "",
        region: p.region || p.store_region || p.store?.region || p.stores?.region || "",
        origen: "local",
        destacado: p.destacado || p.featured || p.is_featured ? "si" : "no",
        premium: p.premium || p.is_premium || false,
        membresia: p.membresia || p.membership_plan || p.plan || "",
        plan: p.plan || p.membership_plan || p.store?.plan || p.stores?.plan || "",
        votos: p.votos || p.votes_count || 0,
        actualizado: p.actualizado || p.updated_at || p.created_at || new Date().toISOString(),
        fuente_datos: "supabase"
      };
    }

    async function cargarComercioLocalSupabase() {
      if (!SUPABASE_ACTIVO) return [];
      try {
        const endpoint = `${SUPABASE_URL}/rest/v1/public_products_local?select=*&order=destacado.desc,updated_at.desc`;
        const resp = await fetch(endpoint, { headers: supabaseHeaders(), cache: "no-store" });
        if (!resp.ok) throw new Error(`Supabase respondió ${resp.status}`);
        const data = await resp.json();
        return Array.isArray(data) ? data.map(normalizarProductoSupabase) : [];
      } catch (error) {
        console.warn("[Supabase/local]", error);
        return [];
      }
    }

    async function guardarLeadSupabase(tipo, datos) {
      if (!SUPABASE_ACTIVO) return false;
      try {
        const resp = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
          method: "POST",
          headers: { ...supabaseHeaders(), "Prefer": "return=minimal" },
          body: JSON.stringify({
            tipo,
            nombre: datos.nombre || null,
            negocio: datos.negocio || null,
            whatsapp: datos.whatsapp || null,
            comuna: datos.comuna || null,
            mensaje: datos.mensaje || null,
            producto_buscado: datos.producto || null,
            mascota: datos.mascota || null,
            origen: "web",
            estado: "nuevo"
          })
        });
        return resp.ok;
      } catch (error) {
        console.warn("[Supabase/leads]", error);
        return false;
      }
    }

    async function cargarDatos() {
      const [ml, localesSupabase] = await Promise.all([
        cargarOfertasMercadoLibre(),
        cargarComercioLocalSupabase()
      ]);

      TODOS = [...localesSupabase, ...ml.productos];

      if (!TODOS.length && !ml.ok && !SUPABASE_ACTIVO) {
        document.getElementById("actualizado").textContent = "No se pudo cargar la actualización.";
        document.getElementById("premium-carousel").innerHTML = "";
        document.getElementById("local-grid").innerHTML = `
          <div class="vacio">
            <h3>No se encontraron ofertas.</h3>
            <p>Revisa que exista /data/ofertas.json y que GitHub Actions haya generado productos.</p>
          </div>
        `;
        document.getElementById("mercadolibre-grid").innerHTML = "";
        return;
      }

      const fechas = TODOS.map(p => new Date(p.actualizado || p.fecha_actualizacion || p.fecha || ml.actualizado || Date.now()).getTime()).filter(Boolean);
      const fecha = new Date(fechas.length ? Math.max(...fechas) : Date.now());
      window.FECHA_ACTUALIZACION = fecha;
      document.getElementById("actualizado").textContent = tiempoRelativo(fecha);

      cargarFiltros();
      renderStats();
      renderGrid();
      actualizarJSONLD();
    }

    function cargarFiltros() {
      const categorias = [...new Set(TODOS.map(p => normalizar(p.categoria || "general")))].sort();
      const tiendas = [...new Set(TODOS.map(p => detectarTienda(p)))].sort();
      const comunas = [...new Set(TODOS.map(p => repararTexto(p.comuna || p.ciudad || p.region || p.zona || p.ubicacion || "")).filter(Boolean))].sort();

      document.getElementById("filtro-categoria").innerHTML =
        "<option value=''>Todas las categorías</option>" +
        categorias.map(cat => `<option value="${escaparHTML(cat)}">${escaparHTML(categoriaBonita(cat))}</option>`).join("");

      document.getElementById("filtro-tienda").innerHTML =
        "<option value=''>Todas las tiendas</option>" +
        tiendas.map(t => `<option value="${escaparHTML(normalizar(t))}">${escaparHTML(t)}</option>`).join("");

      document.getElementById("filtro-comuna").innerHTML =
        "<option value=''>¿Dónde estás buscando?</option>" +
        comunas.map(c => `<option value="${escaparHTML(normalizar(c))}">${escaparHTML(c)}</option>`).join("");
    }

    function filtrar() {
      const q = normalizar(document.getElementById("busqueda").value);
      const cat = document.getElementById("filtro-categoria").value;
      const tienda = document.getElementById("filtro-tienda").value;
      const origen = document.getElementById("filtro-origen").value;
      const comunaFiltro = document.getElementById("filtro-comuna").value;
      const orden = document.getElementById("filtro-orden").value;

      let lista = TODOS.filter(p => {
        const titulo = normalizar(p.titulo || "");
        const desc = normalizar(p.descripcion || "");
        const categoria = normalizar(p.categoria || "general");
        const tiendaP = normalizar(detectarTienda(p));
        const origenP = detectarOrigen(p);
        const comunaP = normalizar(p.comuna || p.ciudad || p.region || p.zona || p.ubicacion || "");

        if (q && !titulo.includes(q) && !desc.includes(q)) return false;
        if (cat && categoria !== cat) return false;
        if (tienda && tiendaP !== tienda) return false;
        if (origen && origenP !== origen) return false;
        if (comunaFiltro && !comunaP.includes(comunaFiltro)) return false;
        if (filtroDescuento && Number(p.descuento_pct || 0) <= 0) return false;

        return true;
      });

      lista.sort((a, b) => {
        const comunaA = normalizar(a.comuna || a.ciudad || a.region || a.zona || a.ubicacion || "");
        const comunaB = normalizar(b.comuna || b.ciudad || b.region || b.zona || b.ubicacion || "");
        if (comunaFiltro) {
          const matchA = comunaA.includes(comunaFiltro) ? 0 : 1;
          const matchB = comunaB.includes(comunaFiltro) ? 0 : 1;
          if (matchA !== matchB) return matchA - matchB;
        }
        const prioridadA = detectarOrigen(a) === "local" ? 0 : 1;
        const prioridadB = detectarOrigen(b) === "local" ? 0 : 1;
        if (prioridadA !== prioridadB) return prioridadA - prioridadB;
        if (orden === "descuento") return Number(b.descuento_pct || 0) - Number(a.descuento_pct || 0);
        if (orden === "precio_asc") return Number(a.precio_clp || 0) - Number(b.precio_clp || 0);
        if (orden === "precio_desc") return Number(b.precio_clp || 0) - Number(a.precio_clp || 0);
        return 0;
      });

      return lista;
    }

    function renderStats() {
      const total = TODOS.length;
      const maxDesc = total ? Math.max(...TODOS.map(p => Number(p.descuento_pct || 0))) : 0;
      const locales = TODOS.filter(p => detectarOrigen(p) === "local").length;
      const mercadoLibre = TODOS.filter(p => detectarOrigen(p) === "mercadolibre").length;

      document.getElementById("hero-total").textContent = total;
      document.getElementById("hero-desc").textContent = Math.round(maxDesc) + "%";

      document.getElementById("stats").innerHTML = `
        <div class="stat"><strong>${total}</strong>ofertas activas</div>
        <div class="stat"><strong>${Math.round(maxDesc)}%</strong>mayor descuento</div>
        <div class="stat"><strong>${locales}</strong>comercio local</div>
        <div class="stat"><strong>${mercadoLibre}</strong>MercadoLibre</div>
      `;
    }

    function renderGrid() {
      const lista = filtrar();
      const premium = lista.filter(p => detectarOrigen(p) === "local" && esDestacadoMiembro(p));
      const locales = lista.filter(p => detectarOrigen(p) === "local");
      const mercadoLibre = lista.filter(p => detectarOrigen(p) === "mercadolibre");

      const premiumFinal = premium;
      const carousel = document.getElementById("premium-carousel");
      const localGrid = document.getElementById("local-grid");
      const mlGrid = document.getElementById("mercadolibre-grid");

      if (!lista.length) {
        carousel.innerHTML = "";
        localGrid.innerHTML = `
          <div class="vacio">
            <h3>No hay ofertas con esos filtros.</h3>
            <p>Prueba con otra categoría, tienda, fuente u orden.</p>
          </div>
        `;
        mlGrid.innerHTML = "";
        return;
      }

      const flyersMiembros = [
        renderFlyerCard("/assets/haz_crecer_tu_negocio_local.png", "Haz crecer tu negocio local", 1),
        renderFlyerCard("/assets/tu_tienda_para_amantes_de_mascotas.png", "Tu tienda podría estar acá", 2),
        renderFlyerCard("/assets/destaca_tus_ofertas_del_mes.png", "Destaca tus ofertas del mes", 3)
      ];

      carousel.innerHTML = flyersMiembros.join("") + (premiumFinal.length
        ? premiumFinal.map((p, idx) => renderCard(p, idx + 4, true)).join("")
        : "");

      localGrid.innerHTML = locales.length
        ? locales.map((p, idx) => renderCard(p, idx, false)).join("")
        : `<div class="vacio"><div class="vacio-icon">🐾</div><h3>Pronto verás tiendas locales acá.</h3><p>¿Tienes un negocio para mascotas? Súmate y muestra tus productos a nuevos clientes.</p><a class="btn btn-primary empty-cta" href="#marcas">Sumar mi tienda</a></div>`;

      mlGrid.innerHTML = mercadoLibre.length
        ? mercadoLibre.map((p, idx) => renderCard(p, idx, false)).join("")
        : `<div class="vacio"><div class="vacio-icon">🛒</div><h3>No hay ofertas de MercadoLibre cargadas.</h3><p>Pronto agregaremos ofertas online para comparar precios.</p></div>`;

      iniciarCarruselMiembros();
    }

    let carruselMiembrosTimer = null;
    let carruselPausado = false;

    function iniciarCarruselMiembros() {
      const carousel = document.getElementById("premium-carousel");
      const dotsWrap = document.getElementById("premium-dots");
      if (!carousel) return;

      if (carruselMiembrosTimer) {
        clearInterval(carruselMiembrosTimer);
        carruselMiembrosTimer = null;
      }

      const items = Array.from(carousel.querySelectorAll(".flyer-card, .card"));
      if (!items.length) return;

      let indiceCarrusel = 0;

      function actualizarDots() {
        if (!dotsWrap) return;
        dotsWrap.innerHTML = items.map((_, i) => `
          <button class="carousel-dot${i === indiceCarrusel ? " activo" : ""}" type="button" aria-label="Ver aviso ${i + 1}"></button>
        `).join("");

        Array.from(dotsWrap.querySelectorAll(".carousel-dot")).forEach((dot, i) => {
          dot.addEventListener("click", () => {
            indiceCarrusel = i;
            moverA(indiceCarrusel, true);
          });
        });
      }

      function moverA(indice, suave = true) {
        const item = items[indice];
        if (!item) return;
        carousel.scrollTo({
          left: item.offsetLeft - carousel.offsetLeft,
          behavior: suave ? "smooth" : "auto"
        });
        actualizarDots();
      }

      const pausar = () => { carruselPausado = true; };
      const reanudar = () => { carruselPausado = false; };

      carousel.onmouseenter = pausar;
      carousel.onmouseleave = reanudar;
      carousel.ontouchstart = pausar;
      carousel.ontouchend = () => setTimeout(reanudar, 1800);

      actualizarDots();
      moverA(0, false);

      if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      carruselMiembrosTimer = setInterval(() => {
        if (carruselPausado) return;
        indiceCarrusel = (indiceCarrusel + 1) % items.length;
        moverA(indiceCarrusel, true);
      }, 3600);
    }

    function renderFlyerCard(src, alt, idx = 0) {
      return `
        <a class="flyer-card" href="#marcas" aria-label="${escaparHTML(alt)}" onclick="registrarClic('Flyer membresía: ${escaparHTML(alt)}')" style="animation-delay:${Math.min(idx * 0.04, 0.6)}s">
          <img src="${escaparHTML(src)}" alt="${escaparHTML(alt)}" loading="lazy">
        </a>
      `;
    }

    function renderPromoCard(titulo, descripcion, textoBoton, emoji, idx = 0) {
      const linkContacto = "#marcas";
      return `
        <article class="card promo-card" style="animation-delay:${Math.min(idx * 0.04, 0.6)}s">
          <div class="promo-visual">
            <div class="promo-emoji" aria-hidden="true">${emoji}</div>
          </div>
          <div class="promo-body">
            <span class="promo-label">Espacio disponible</span>
            <h3>${escaparHTML(titulo)}</h3>
            <p>${escaparHTML(descripcion)}</p>
            <a class="btn-promo" href="${linkContacto}" onclick="registrarClic('CTA tienda destacada')">${escaparHTML(textoBoton)}</a>
          </div>
        </article>
      `;
    }

    function renderCard(p, idx, esPremium = false) {
        const tituloRaw = repararTexto(p.titulo || "Producto sin título");
        const titulo = escaparHTML(tituloRaw);
        const descripcion = escaparHTML(p.descripcion || "");
        const precio = p.precio_fmt ? escaparHTML(p.precio_fmt) : fmtCLP(p.precio_clp);
        const precioOriginal = p.precio_orig_fmt || p.precio_original_fmt ? escaparHTML(p.precio_orig_fmt || p.precio_original_fmt) : "";
        const descuento = Number(p.descuento_pct || p.descuento || 0);
        const categoria = escaparHTML(categoriaBonita(p.categoria));
        const tiendaRaw = detectarTienda(p);
        const tienda = escaparHTML(tiendaRaw);
        const origen = detectarOrigen(p);
        const origenTexto = origen === "mercadolibre" ? "MercadoLibre" : `Local · ${tiendaRaw}`;
        const imagen = String(p.imagen || "").trim();
        const link = String(p.link_afiliado || p.link_oferta || "#").trim();
        const fechaOferta = new Date(p.actualizado || p.fecha_actualizacion || p.fecha || window.FECHA_ACTUALIZACION || Date.now());
        const fresh = tiempoRelativo(fechaOferta);
        const voteKey = claveOferta(p);
        const baseVotos = Number(p.votos || p.likes || p.puntos || 0);
        const totalVotos = votosOferta(p);
        const voted = yaVote(p);

        const imagenHTML = imagen
          ? `<img class="card-img" src="${escaparHTML(imagen)}" alt="${titulo}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=&quot;img-placeholder&quot;>Imagen no disponible</div>'">`
          : `<div class="img-placeholder">Imagen no disponible</div>`;

        const esRelampago = descuento >= 40;
        const esCaliente = descuento >= 50;
        const ahorro = (precioOriginal && descuento > 0)
          ? Number(p.precio_orig_clp || p.precio_original_clp || 0) - Number(p.precio_clp || 0)
          : 0;

        const target = origen === "mercadolibre" ? "_self" : "_blank";

        return `
          <article class="card" style="animation-delay:${Math.min(idx * 0.04, 0.6)}s">
            <div class="card-img-wrap">
              ${descuento > 0 ? `<span class="discount-badge${esCaliente ? " hot" : ""}">-${Math.round(descuento)}%</span>` : ""}
              ${esPremium ? `<span class="flash-badge">Miembro</span>` : (esRelampago ? `<span class="flash-badge">Oferta top</span>` : "")}
              <button class="vote-btn${voted ? " voted" : ""}" type="button" onclick="votarOfertaDesdeBoton(this, '${voteKey}')" aria-label="Votar oferta">♥ <span data-vote-count="${voteKey}" data-base="${baseVotos}">${totalVotos}</span></button>
              <span class="category-badge">${categoria}</span>
              <span class="origin-badge ${origen === "mercadolibre" ? "marketplace" : ""}">${origen === "mercadolibre" ? "MercadoLibre" : "Local"}</span>
              ${imagenHTML}
            </div>

            <div class="card-body">
              <div class="card-meta-row">
                <span class="source-pill ${origen === "mercadolibre" ? "ml" : "local"}">${origen === "mercadolibre" ? "🛒" : "📍"} ${escaparHTML(origenTexto)}</span>
                <span class="freshness">● ${escaparHTML(fresh)}</span>
              </div>

              <h3 class="card-title">${titulo}</h3>
              ${descripcion ? `<p class="card-desc">${descripcion}</p>` : ""}

              <div class="price-line">
                ${precioOriginal && descuento > 0 ? `<div class="old-price">Antes ${precioOriginal}</div>` : ""}
                <div class="price">${precio}</div>
                ${ahorro > 0 ? `<span class="savings-tag">Ahorras ${fmtCLP(ahorro)}</span>` : ""}
              </div>

              <p class="affiliate-note">${origen === "mercadolibre" ? "Compra directa en MercadoLibre. El pago, despacho y garantía se gestionan en la plataforma." : "Contacta directo con la tienda para comprar, retirar o coordinar despacho."}</p>

              <a class="btn-offer" href="${escaparHTML(link)}" target="${target}" rel="noopener noreferrer sponsored" onclick='registrarClic(${JSON.stringify(tituloRaw)})'>
                ${origen === "mercadolibre" ? "Ver en MercadoLibre" : "Contactar tienda"}
              </a>
            </div>
          </article>
        `;
    }

    document.getElementById("busqueda").addEventListener("input", renderGrid);
    document.getElementById("filtro-categoria").addEventListener("change", renderGrid);
    document.getElementById("filtro-tienda").addEventListener("change", renderGrid);
    document.getElementById("filtro-origen").addEventListener("change", renderGrid);
    document.getElementById("filtro-comuna").addEventListener("change", renderGrid);
    document.getElementById("filtro-orden").addEventListener("change", renderGrid);

    document.getElementById("chip-descuento").addEventListener("click", function() {
      filtroDescuento = !filtroDescuento;
      this.classList.toggle("activo", filtroDescuento);
      renderGrid();
    });


    function activarNavegacionInterna() {
      document.querySelectorAll('a[href^="#"]').forEach(function(enlace) {
        enlace.addEventListener("click", function(evento) {
          const hash = this.getAttribute("href");
          if (!hash || hash === "#") return;

          const destino = document.querySelector(hash);
          if (!destino) return;

          evento.preventDefault();
          destino.scrollIntoView({ behavior: "smooth", block: "start" });

          try {
            history.pushState(null, "", hash);
          } catch (e) {}
        });
      });
    }

    document.getElementById("pedido-modal")?.addEventListener("click", function(event) {
      if (event.target === this) cerrarModalPedido();
    });

    activarNavegacionInterna();
    cargarDatos();
