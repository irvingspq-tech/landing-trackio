/* ==========================================================================
   TrackI — trackibot.js
   Asistente virtual de Trackio (Beta). Responde con faq.json, generado desde
   borrador-preguntas.md, y deriva al equipo lo que no sabe. No guarda nada.

   Configuración en la etiqueta <script>:
     data-faq        ruta de faq.json
     data-css        ruta de trackibot.css, si el script debe cargarla (si no, va en el <head>)
     data-demo-url   destino del botón "Solicitar demo"
     data-email      correo de contacto
     data-phone      teléfono para "Llamar" (solo dígitos, con +52)
     data-whatsapp   número de WhatsApp para wa.me (solo dígitos, con 52)
     data-auto-open  "true" para abrirlo al cargar la página
   ========================================================================== */

(function () {
  "use strict";

  var script = document.currentScript;
  var config = {
    faq: script.getAttribute("data-faq") || "faq.json",
    css: script.getAttribute("data-css"),
    demoUrl: script.getAttribute("data-demo-url") || "https://trackio.com.mx/#contacto",
    email: script.getAttribute("data-email") || "c.arechederra@trackio.com.mx",
    phone: script.getAttribute("data-phone") || "+525521673173",
    whatsapp: script.getAttribute("data-whatsapp") || "525566303516",
    autoOpen: script.getAttribute("data-auto-open") === "true"
  };

  var ICONS = {
    chat: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    bot: '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>',
    close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    send: '<path d="M3.714 3.048a.498.498 0 0 0-.683.627l2.843 7.627a2 2 0 0 1 0 1.396l-2.842 7.627a.498.498 0 0 0 .682.627l18-8.5a.5.5 0 0 0 0-.904z"/><path d="M6 12h16"/>',
    calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
    mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    phone: '<path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"/>',
    whatsapp: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>'
  };

  var SMALLTALK = {
    greeting: "¡Hola! ¿En qué te puedo ayudar?",
    thanks: "¡Con gusto!",
    bye: "¡Hasta pronto! Aquí estaré si te surge otra duda."
  };

  var data = null;
  var bot = null;
  var started = false;
  var busy = false;
  var els = {};

  function icon(name) {
    return '<svg class="tb-icon" viewBox="0 0 24 24" aria-hidden="true">' + ICONS[name] + "</svg>";
  }

  function build() {
    var root = document.createElement("div");
    root.className = "tb-root";
    root.innerHTML =
      '<button type="button" class="tb-launcher" aria-label="Abrir el asistente TrackI" aria-expanded="false">' + icon("chat") + "</button>" +
      '<section class="tb-panel" role="dialog" aria-label="Asistente virtual TrackI" hidden>' +
      '<header class="tb-header">' +
      '<span class="tb-avatar">' + icon("bot") + "</span>" +
      '<div class="tb-title"><p class="tb-name">TrackI <span class="tb-beta">Beta</span></p><p class="tb-sub">Asistente virtual de Trackio</p></div>' +
      '<button type="button" class="tb-close" aria-label="Cerrar el asistente">' + icon("close") + "</button>" +
      "</header>" +
      '<div class="tb-messages" role="log" aria-live="polite"></div>' +
      '<form class="tb-form" autocomplete="off">' +
      '<input class="tb-input" type="text" maxlength="200" placeholder="Escribe tu pregunta…" aria-label="Escribe tu pregunta" />' +
      '<button type="submit" class="tb-send" aria-label="Enviar">' + icon("send") + "</button>" +
      "</form>" +
      '<p class="tb-note">Respuestas automáticas · No guardamos tu conversación</p>' +
      "</section>";
    document.body.appendChild(root);

    els.root = root;
    els.launcher = root.querySelector(".tb-launcher");
    els.panel = root.querySelector(".tb-panel");
    els.close = root.querySelector(".tb-close");
    els.messages = root.querySelector(".tb-messages");
    els.form = root.querySelector(".tb-form");
    els.input = root.querySelector(".tb-input");
    els.send = root.querySelector(".tb-send");

    els.launcher.addEventListener("click", open);
    els.close.addEventListener("click", close);
    els.form.addEventListener("submit", function (event) {
      event.preventDefault();
      var text = els.input.value.trim();
      if (!text || busy) return;
      els.input.value = "";
      ask(text);
    });
    root.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !els.panel.hidden) close();
    });
  }

  function open() {
    els.panel.hidden = false;
    els.root.classList.add("is-open");
    els.launcher.setAttribute("aria-expanded", "true");
    els.input.focus();
    if (!started) {
      started = true;
      start();
    }
  }

  function close(keepFocus) {
    els.panel.hidden = true;
    els.root.classList.remove("is-open");
    els.launcher.setAttribute("aria-expanded", "false");
    if (keepFocus !== true) els.launcher.focus();
  }

  // Los enlaces a otros sitios abren otra pestaña; los de esta misma página (#contacto) cierran
  // el asistente para que no tape la sección a la que llevan (en celular ocupa toda la pantalla).
  function setTarget(link) {
    if (link.getAttribute("href").charAt(0) === "#") {
      link.addEventListener("click", function () { close(true); });
    } else if (/^https?:/.test(link.href) && link.hostname !== window.location.hostname) {
      link.target = "_blank";
      link.rel = "noopener";
    }
  }

  function start() {
    setBusy(true);
    var typing = showTyping();
    fetch(config.faq)
      .then(function (response) {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
      })
      .then(function (json) {
        data = json;
        bot = window.TrackiMatcher.create(data);
        typing.remove();
        addBot(data.messages.greeting);
        addChips(data.suggested.map(findItem));
        els.messages.scrollTop = 0;
        setBusy(false);
      })
      .catch(function () {
        typing.remove();
        addBot("Por ahora no pude cargar mis respuestas. Escríbenos y con gusto te ayudamos.");
        addActions(["demo", "email", "call", "whatsapp"]);
        setBusy(false);
      });
  }

  function findItem(id) {
    for (var i = 0; i < data.items.length; i++) {
      if (data.items[i].id === id) return data.items[i];
    }
    return null;
  }

  function setBusy(value) {
    busy = value;
    els.send.disabled = value;
  }

  function scrollDown() {
    els.messages.scrollTop = els.messages.scrollHeight;
  }

  function addUser(text) {
    var bubble = document.createElement("div");
    bubble.className = "tb-msg tb-msg--user";
    bubble.textContent = text;
    els.messages.appendChild(bubble);
    scrollDown();
  }

  function addBot(text) {
    var bubble = document.createElement("div");
    bubble.className = "tb-msg tb-msg--bot";
    linkify(text, bubble);
    els.messages.appendChild(bubble);
    scrollDown();
  }

  function showTyping() {
    var typing = document.createElement("div");
    typing.className = "tb-msg tb-msg--bot tb-typing";
    typing.setAttribute("aria-label", "TrackI está escribiendo");
    typing.innerHTML = "<span></span><span></span><span></span>";
    els.messages.appendChild(typing);
    scrollDown();
    return typing;
  }

  function addChips(items) {
    var list = items.filter(Boolean);
    if (!list.length) return;
    var wrap = document.createElement("div");
    wrap.className = "tb-chips";
    list.forEach(function (item) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "tb-chip";
      chip.textContent = item.q;
      chip.addEventListener("click", function () {
        if (!busy) ask(item.q, item);
      });
      wrap.appendChild(chip);
    });
    els.messages.appendChild(wrap);
    scrollDown();
  }

  function addActions(keys, extra) {
    var defs = {
      link: extra && { label: extra.label, icon: "external", href: extra.url, primary: true },
      demo: { label: "Solicitar demo", icon: "calendar", href: config.demoUrl, primary: true },
      email: { label: "Correo", icon: "mail", href: "mailto:" + config.email + "?subject=" + encodeURIComponent("Consulta desde TrackI") },
      call: { label: "Llamar", icon: "phone", href: "tel:" + config.phone },
      whatsapp: { label: "WhatsApp", icon: "whatsapp", href: "https://wa.me/" + config.whatsapp + "?text=" + encodeURIComponent("Hola, tengo una pregunta sobre Trackio.") }
    };
    var wrap = document.createElement("div");
    wrap.className = "tb-actions";
    keys.forEach(function (key) {
      var def = defs[key];
      if (!def) return;
      var link = document.createElement("a");
      link.className = "tb-action" + (def.primary ? " tb-action--primary" : "");
      link.href = def.href;
      setTarget(link);
      link.innerHTML = icon(def.icon);
      link.appendChild(document.createTextNode(def.label));
      wrap.appendChild(link);
    });
    els.messages.appendChild(wrap);
    scrollDown();
  }

  // Convierte correos, teléfonos y direcciones web del texto en enlaces, sin usar HTML del contenido.
  function linkify(text, target) {
    var pattern = /([\w.+-]+@[\w-]+(?:\.[\w-]+)+)|(\+52[\d\s()]{8,}\d)|((?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com\.mx|com|mx)(?:\/[^\s,;)]*[^\s,;).])?)/gi;
    var last = 0;
    var found;
    while ((found = pattern.exec(text))) {
      if (found.index > last) target.appendChild(document.createTextNode(text.slice(last, found.index)));
      var link = document.createElement("a");
      link.textContent = found[0];
      if (found[1]) link.href = "mailto:" + found[1];
      else if (found[2]) link.href = "tel:" + found[2].replace(/[^\d+]/g, "");
      else {
        link.href = /^https?:/.test(found[3]) ? found[3] : "https://" + found[3];
        setTarget(link);
      }
      target.appendChild(link);
      last = pattern.lastIndex;
    }
    if (last < text.length) target.appendChild(document.createTextNode(text.slice(last)));
  }

  function related(item) {
    return data.items.filter(function (other) {
      return other.category === item.category && other.id !== item.id && !other.derive;
    }).slice(0, 2);
  }

  function respond(text, picked) {
    var result = picked ? { type: "answer", item: picked } : bot.match(text);

    if (result.type === "smalltalk") {
      addBot(SMALLTALK[result.kind]);
      if (result.kind !== "bye") addChips(data.suggested.map(findItem));
      return;
    }
    if (result.type === "suggest") {
      addBot(data.messages.suggest);
      addChips(result.items);
      return;
    }
    if (result.type === "fallback" || result.item.derive) {
      addBot(data.messages.fallback);
      addActions(data.fallbackButtons);
      return;
    }
    addBot(result.item.a);
    var link = result.item.link;
    if (link) addActions(link.button ? [link.button] : ["link"], link);
    var more = related(result.item);
    if (more.length) {
      addBot(data.messages.closing);
      addChips(more);
    }
  }

  function ask(text, picked) {
    addUser(text);
    setBusy(true);
    var typing = showTyping();
    window.setTimeout(function () {
      typing.remove();
      respond(text, picked);
      setBusy(false);
      els.input.focus();
    }, 450 + Math.min(text.length * 8, 450));
  }

  function init() {
    build();
    if (config.autoOpen) open();
  }

  // Con data-css el asistente carga su propia hoja de estilos (sin frenar el render de la página)
  // y se arma cuando llega, para que el botón nunca aparezca sin estilo.
  if (config.css) {
    var sheet = document.createElement("link");
    sheet.rel = "stylesheet";
    sheet.href = config.css;
    sheet.addEventListener("load", init);
    document.head.appendChild(sheet);
  } else {
    init();
  }
})();
