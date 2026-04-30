// ═══════════════════════════════════════════════════════════════════════════
// FB PIXEL · financiamiento.norlab.xyz (mismo Datos Norlab — 1776113519756804)
// ─────────────────────────────────────────────────────────────────────────
// Cargar en TODAS las páginas:
//   <script src="/fb-pixel.js"></script>
//   ↑ poner justo antes de </head>
//
// IMPORTANTE: usamos eventos custom específicos de financiera para
// poder optimizar campañas en FB Ads Manager por separado de NORLAB equipos
// (aunque comparten pixel — Opción A).
//
// Helpers:
//   window.finPixel.solicitudIniciada({ monto, plazo })
//   window.finPixel.solicitudCompletada({ monto, plazo, score })
//   window.finPixel.buroAutorizado()
//   window.finPixel.contratoFirmado({ monto, plazo })
//   window.finPixel.simulador({ monto, plazo, mensualidad })
// ═══════════════════════════════════════════════════════════════════════════

(function () {
  var PIXEL_ID = '1776113519756804'

  // Snippet base de Meta (no tocar)
  !(function (f, b, e, v, n, t, s) {
    if (f.fbq) return
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments)
    }
    if (!f._fbq) f._fbq = n
    n.push = n
    n.loaded = !0
    n.version = '2.0'
    n.queue = []
    t = b.createElement(e)
    t.async = !0
    t.src = v
    s = b.getElementsByTagName(e)[0]
    s.parentNode.insertBefore(t, s)
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js')

  fbq('init', PIXEL_ID)
  fbq('track', 'PageView')

  window.finPixel = {
    // Click en simulador → evento middle-funnel
    simulador: function (params) {
      params = params || {}
      fbq('trackCustom', 'Simulador_Calculado', {
        monto: params.monto || 0,
        plazo: params.plazo || 0,
        mensualidad: params.mensualidad || 0,
        currency: 'MXN',
      })
    },

    // Empezó a llenar el formulario de solicitud
    solicitudIniciada: function (params) {
      params = params || {}
      fbq('trackCustom', 'Solicitud_Buro_Iniciada', {
        value: params.monto || 0,
        plazo: params.plazo || 0,
        currency: 'MXN',
      })
      fbq('track', 'InitiateCheckout', {
        value: params.monto || 0,
        currency: 'MXN',
      })
    },

    // Completó la solicitud (envío exitoso)
    solicitudCompletada: function (params) {
      params = params || {}
      fbq('trackCustom', 'Solicitud_Buro_Completada', {
        value: params.monto || 0,
        plazo: params.plazo || 0,
        score: params.score || null,
        currency: 'MXN',
      })
      fbq('track', 'Lead', {
        value: params.monto || 0,
        currency: 'MXN',
        content_category: 'financiamiento',
      })
    },

    // Buró autorizado (pasó el filtro)
    buroAutorizado: function (params) {
      params = params || {}
      fbq('trackCustom', 'Buro_Autorizado', {
        score: params.score || null,
      })
    },

    // Conversión final — contrato firmado
    contratoFirmado: function (params) {
      params = params || {}
      fbq('track', 'Purchase', {
        value: params.monto || 0,
        currency: 'MXN',
        content_type: 'financiamiento',
        plazo: params.plazo || 0,
      })
    },

    // Click en WhatsApp / contacto
    contacto: function (params) {
      params = params || {}
      fbq('track', 'Contact', { canal: params.canal || 'whatsapp' })
    },

    // Catch-all
    custom: function (eventName, params) {
      fbq('trackCustom', eventName, params || {})
    },

    // Captura de UTMs desde la URL actual + sessionStorage (sobrevive page jumps)
    getUTMs: function () {
      try {
        var p = new URLSearchParams(window.location.search)
        var utms = {
          utm_source:   p.get('utm_source'),
          utm_medium:   p.get('utm_medium'),
          utm_campaign: p.get('utm_campaign'),
          utm_content:  p.get('utm_content'),
          utm_term:     p.get('utm_term'),
          fbclid:       p.get('fbclid'),
        }
        var hasAny = Object.values(utms).some(function (v) { return v != null })
        if (hasAny) {
          try { sessionStorage.setItem('norlab_utms', JSON.stringify(utms)) } catch (_) {}
          return utms
        }
        // Si la URL no trae UTMs, usa los guardados en la sesión
        try {
          var saved = sessionStorage.getItem('norlab_utms')
          if (saved) return JSON.parse(saved)
        } catch (_) {}
        return {}
      } catch (e) { return {} }
    },

    // Manda lead a /api/track-lead (cross-origin a os.norlab.xyz).
    // Llamarlo en cada submit de form: simulador, solicitud, contacto WA.
    trackLead: function (extra) {
      try {
        var utms = window.finPixel.getUTMs()
        var body = Object.assign({}, utms, {
          landing_url: window.location.href,
          referrer:    document.referrer || null,
          user_agent:  navigator.userAgent,
        }, extra || {})
        // fire-and-forget — no bloquea UI si falla
        fetch('https://os.norlab.xyz/api/track-lead', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          keepalive: true,
        }).catch(function () { /* silent */ })
      } catch (e) { /* silent */ }
    },
  }

  // Auto-tracking — clicks de WhatsApp/email/tel
  document.addEventListener('DOMContentLoaded', function () {
    document.body.addEventListener(
      'click',
      function (e) {
        var a = e.target.closest && e.target.closest('a[href]')
        if (!a) return
        var href = a.getAttribute('href') || ''
        if (href.indexOf('wa.me') !== -1 || href.indexOf('whatsapp.com') !== -1) {
          window.finPixel.contacto({ canal: 'whatsapp' })
        } else if (href.indexOf('mailto:') === 0) {
          window.finPixel.contacto({ canal: 'email' })
        } else if (href.indexOf('tel:') === 0) {
          window.finPixel.contacto({ canal: 'tel' })
        }
      },
      true
    )
  })
})()
