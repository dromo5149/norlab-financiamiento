// ═══════════════════════════════════════════════════════════════════
// NORLAB Financiera · Header y footer reutilizables
// Cada página llama a renderHeader('como-funciona') / renderFooter()
// ═══════════════════════════════════════════════════════════════════

const NAV_ITEMS = [
  { href: '/index.html#simulador',  label: 'Simulador',  key: 'sim'  },
  { href: '/planes.html',           label: 'Planes',     key: 'planes' },
  { href: '/como-funciona.html',    label: 'Cómo funciona', key: 'como' },
  { href: '/requisitos.html',       label: 'Requisitos', key: 'req'  },
  { href: '/faq.html',              label: 'FAQ',        key: 'faq'  },
  { href: 'https://norlab.com.mx/portal/', label: 'Mi portal', key: 'portal' },
]

const WA_NUM = '525621836094'
const WA_TXT_DEFAULT = 'Hola NORLAB quiero información sobre financiamiento de equipo de laboratorio'
const waLink = (txt) => `https://wa.me/${WA_NUM}?text=${encodeURIComponent(txt || WA_TXT_DEFAULT)}`

// SVG inline del logo NORLAB (compacto)
const LOGO_SVG = `<svg width="120" height="32" viewBox="0 0 240 64" xmlns="http://www.w3.org/2000/svg">
  <text x="0" y="40" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="32" font-weight="900" fill="#0b1f3a" letter-spacing="-1">NORLAB</text>
  <rect x="172" y="22" width="48" height="2" fill="#1976d2"/>
  <text x="172" y="48" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="11" font-weight="700" fill="#1976d2" letter-spacing="2">FINANCIERA</text>
</svg>`

const WA_ICON = `<svg width="18" height="18" fill="white" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`

function renderHeader(activeKey) {
  const links = NAV_ITEMS.map(i =>
    `<a href="${i.href}"${activeKey === i.key ? ' class="active"' : ''}${i.href.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}>${i.label}</a>`
  ).join('')
  return `
    <nav class="topbar">
      <a href="/" class="nav-logo">${LOGO_SVG}</a>
      <div class="nav-links">${links}</div>
      <div class="nav-right">
        <a class="btn-wa-sm" href="${waLink()}" target="_blank">${WA_ICON} WhatsApp</a>
        <a class="btn-nav-outline" href="https://norlab.com.mx/portal/" target="_blank">Mi portal →</a>
        <a class="btn-nav" href="/solicitud.html">Solicitar →</a>
      </div>
    </nav>
  `
}

function renderFooter() {
  const year = new Date().getFullYear()
  return `
    <footer class="site-footer">
      <div class="footer-grid">
        <div class="footer-brand">
          ${LOGO_SVG.replace('fill="#0b1f3a"', 'fill="#fff"').replace('fill="#1976d2"', 'fill="#64b5f6"')}
          <p>Vertical financiera de NORLAB. Financiamos la operación de laboratorios, clínicas y hospitales en todo México con procesos 100% digitales.</p>
        </div>
        <div class="footer-col">
          <h4>Producto</h4>
          <ul>
            <li><a href="/planes.html">Planes</a></li>
            <li><a href="/como-funciona.html">Cómo funciona</a></li>
            <li><a href="/requisitos.html">Requisitos</a></li>
            <li><a href="/index.html#simulador">Simulador</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Soporte</h4>
          <ul>
            <li><a href="/faq.html">Preguntas frecuentes</a></li>
            <li><a href="${waLink()}" target="_blank">WhatsApp</a></li>
            <li><a href="mailto:info@norlab.xyz">info@norlab.xyz</a></li>
            <li><a href="https://norlab.com.mx/portal/" target="_blank">Portal cliente</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>NORLAB</h4>
          <ul>
            <li><a href="https://norlab.com.mx/inicio" target="_blank">Inicio</a></li>
            <li><a href="https://norlab.com.mx/analizadores-de-laboratorio" target="_blank">Equipos</a></li>
            <li><a href="https://os.norlab.xyz/p/precios" target="_blank">Catálogo con precios</a></li>
            <li><a href="https://norlab.com.mx/contactanos" target="_blank">Contacto</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© ${year} Grupo Rohmnos S. de R.L. de C.V. · RFC GRO1903139Z6</span>
        <span>Naucalpan de Juárez, Estado de México · WhatsApp 56 2183 6094</span>
      </div>
    </footer>
  `
}

// Helper para inyectar al cargar
function mount(activeKey) {
  document.addEventListener('DOMContentLoaded', () => {
    const h = document.getElementById('header')
    const f = document.getElementById('footer')
    if (h) h.innerHTML = renderHeader(activeKey)
    if (f) f.innerHTML = renderFooter()
  })
}
