/* ==========================================================================
   TrackI — matcher.js
   Busca la pregunta del FAQ más parecida a lo que escribe el visitante.
   Sin red ni IA: normaliza, aplica sinónimos y pondera por relevancia (IDF).
   ========================================================================== */

(function (root) {
  "use strict";

  var STOPWORDS = toSet(
    "a al algo algun alguna alguno algunos ante asi bien cada con contra de del el ella ellos en entre era es esa ese eso esta estan este esto fue ha han hay hace hacen la las le les lo los mas me mi mis muy ni no nos nuestra nuestro o os otra otro para pero poco por porque pues que se sea ser si sin sobre solo son su sus tal tambien te tengo tiene tienen tu tus un una uno unos unas usted ustedes vez y ya yo puedo puede pueden quiero quisiera saber favor hola gracias seria podria voy vamos va dan dar dame cual cuales hacer"
  );

  // Frases de varias palabras → término canónico (se aplican antes de separar palabras).
  var PHRASES = [
    ["aire acondicionado", "hvac"],
    ["aires acondicionados", "hvac"],
    ["tiempo real", "tiemporeal"],
    ["factor de potencia", "factorpotencia"],
    ["paneles solares", "solar"],
    ["panel solar", "solar"],
    ["inicio de sesion", "login"],
    ["iniciar sesion", "login"],
    ["correo electronico", "correo"],
    ["periodo de prueba", "pruebagratis"],
    ["prueba gratis", "pruebagratis"],
    ["prueba gratuita", "pruebagratis"],
    ["suministro calificado", "suministrocalificado"],
    ["iso 50001", "iso50001"],
    ["casos de exito", "casoexito"],
    ["caso de exito", "casoexito"],
    ["redes sociales", "redsocial"],
    ["data bot", "databot"]
  ];

  // Palabra → término canónico.
  var SYNONYMS = {
    costo: "precio", costos: "precio", cuesta: "precio", cuestan: "precio", precio: "precio", precios: "precio",
    vale: "precio", cotizacion: "precio", cotizar: "precio", presupuesto: "precio",
    medidor: "medi", medidores: "medi", sensor: "medi", sensores: "medi", medicion: "medi", mediciones: "medi",
    medir: "medi", miden: "medi", mide: "medi", mido: "medi", medida: "medi",
    instalar: "instal", instala: "instal", instalacion: "instal", instalan: "instal", instalado: "instal", instalaciones: "instal", montaje: "instal",
    ahorrar: "ahorr", ahorro: "ahorr", ahorros: "ahorr", ahorrando: "ahorr", ahorran: "ahorr",
    calculo: "calcul", calculos: "calcul", calcular: "calcul", calcula: "calcul", calculan: "calcul",
    calculadora: "calcul", calculadoras: "calcul", simulador: "calcul", simulacion: "calcul",
    demo: "demo", demos: "demo", demostracion: "demo", cita: "demo",
    celular: "celular", movil: "celular", app: "celular", aplicacion: "celular", smartphone: "celular",
    whatsapp: "whatsapp", whats: "whatsapp", wasap: "whatsapp", wa: "whatsapp",
    correo: "correo", email: "correo", mail: "correo", mails: "correo",
    contrasena: "contrasena", password: "contrasena", clave: "contrasena",
    oficina: "oficina", oficinas: "oficina", direccion: "oficina", ubicacion: "oficina", ubicados: "oficina", domicilio: "oficina",
    usuario: "usuario", usuarios: "usuario", cuentas: "usuario",
    alerta: "alerta", alertas: "alerta", notificacion: "alerta", notificaciones: "alerta", aviso: "alerta", avisos: "alerta", avisan: "alerta",
    pronostico: "pronostico", pronosticos: "pronostico", prediccion: "pronostico", predicciones: "pronostico",
    predecir: "pronostico", predice: "pronostico", pronosticar: "pronostico", proyeccion: "pronostico",
    exportar: "exportar", descargar: "exportar", excel: "exportar", csv: "exportar", exportacion: "exportar",
    integrar: "integra", integracion: "integra", integra: "integra", api: "integra",
    capacitacion: "capacita", entrenamiento: "capacita", curso: "capacita", capacitan: "capacita",
    horario: "horario", horarios: "horario", hora: "horario", horas: "horario",
    soporte: "soporte", falla: "soporte", fallas: "soporte", problema: "soporte", problemas: "soporte",
    seguridad: "segur", seguro: "segur", seguros: "segur", protegidos: "segur", proteccion: "segur", ciberseguridad: "segur",
    dueno: "dueno", propiedad: "dueno", propietario: "dueno",
    contrato: "contrato", plazo: "contrato", permanencia: "contrato", forzoso: "contrato",
    pago: "pago", pagos: "pago", pagar: "pago", mensualidad: "pago",
    empresa: "empresa", empresas: "empresa", compania: "empresa",
    sucursal: "sucursal", sucursales: "sucursal", tienda: "sucursal", tiendas: "sucursal",
    planta: "planta", plantas: "planta", fabrica: "planta",
    recibo: "recibo", recibos: "recibo", factura: "factura", facturas: "factura", facturan: "factura", facturacion: "factura", cfdi: "factura",
    asesor: "persona", humano: "persona", persona: "persona", vendedor: "persona", ejecutivo: "persona",
    detener: "detener", parar: "detener", paro: "detener", parada: "detener", apagar: "detener", interrumpir: "detener", cortar: "detener",
    cobro: "cobro", cobran: "cobro", cobrada: "cobro", cobrado: "cobro", cobrar: "cobro", cobra: "cobro",
    mal: "error", error: "error", errores: "error", incorrecto: "error", erroneo: "error",
    eres: "asistente", asistente: "asistente", bot: "asistente"
  };

  var SMALLTALK = {
    greeting: toSet("hola buenas buenos dias tardes noches hey saludos que tal"),
    thanks: toSet("gracias muchas mil ok vale perfecto genial excelente listo"),
    bye: toSet("adios bye hasta luego pronto nos vemos chao")
  };

  var QUESTION_WEIGHT = 3;
  var ANSWER_WEIGHT = 1;

  function toSet(words) {
    var set = Object.create(null);
    words.split(/\s+/).forEach(function (w) {
      if (w) set[w] = true;
    });
    return set;
  }

  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function stem(word) {
    if (word.length > 5 && /[rlndz]es$/.test(word)) return word.slice(0, -2);
    if (word.length > 4 && /s$/.test(word)) return word.slice(0, -1);
    return word;
  }

  function canonical(word) {
    if (SYNONYMS[word]) return SYNONYMS[word];
    var stemmed = stem(word);
    return SYNONYMS[stemmed] || stemmed;
  }

  function words(text) {
    var normalized = " " + normalize(text) + " ";
    PHRASES.forEach(function (pair) {
      normalized = normalized.split(" " + pair[0] + " ").join(" " + pair[1] + " ");
    });
    return normalized.split(" ").filter(function (word) {
      return word && !STOPWORDS[word];
    });
  }

  function tokenize(text, fix) {
    var out = [];
    words(text).forEach(function (word) {
      var token = fix ? fix(word) : canonical(word);
      if (out.indexOf(token) === -1) out.push(token);
    });
    return out;
  }

  // Distancia de edición acotada, para tolerar errores de dedo.
  function editDistance(a, b, limit) {
    if (Math.abs(a.length - b.length) > limit) return limit + 1;
    var prev = [];
    var prevPrev = [];
    for (var j = 0; j <= b.length; j++) prev[j] = j;
    for (var i = 1; i <= a.length; i++) {
      var cur = [i];
      var rowMin = i;
      for (var k = 1; k <= b.length; k++) {
        var cost = a[i - 1] === b[k - 1] ? 0 : 1;
        cur[k] = Math.min(prev[k] + 1, cur[k - 1] + 1, prev[k - 1] + cost);
        if (i > 1 && k > 1 && a[i - 1] === b[k - 2] && a[i - 2] === b[k - 1]) cur[k] = Math.min(cur[k], prevPrev[k - 2] + 1);
        if (cur[k] < rowMin) rowMin = cur[k];
      }
      if (rowMin > limit) return limit + 1;
      prevPrev = prev;
      prev = cur;
    }
    return prev[b.length];
  }

  function create(data) {
    var items = data.items.map(function (item) {
      var phrasings = [item.q].concat(item.variants || []).map(function (text) { return tokenize(text); });
      var questionTokens = [].concat.apply([], phrasings);
      return {
        item: item,
        phrasings: phrasings,
        q: toSet(questionTokens.join(" ")),
        a: toSet(tokenize(item.a || "").join(" "))
      };
    });

    var df = Object.create(null);
    items.forEach(function (entry) {
      var seen = Object.create(null);
      Object.keys(entry.q).concat(Object.keys(entry.a)).forEach(function (t) {
        if (seen[t]) return;
        seen[t] = true;
        df[t] = (df[t] || 0) + 1;
      });
    });
    var vocabulary = Object.keys(df);
    var total = items.length;

    function idf(token) {
      return Math.log(1 + total / (1 + (df[token] || 0)));
    }

    var candidates = vocabulary.concat(Object.keys(SYNONYMS));

    // Corrige errores de dedo comparando la palabra contra el vocabulario y los sinónimos conocidos.
    function fixWord(word) {
      var token = canonical(word);
      if (df[token] || SYNONYMS[word] || word.length < 5) return token;
      var limit = word.length >= 8 ? 2 : 1;
      var best = null;
      var bestDistance = limit + 1;
      candidates.forEach(function (candidate) {
        var d = editDistance(word, candidate, limit);
        if (d < bestDistance) {
          bestDistance = d;
          best = candidate;
        }
      });
      return best ? canonical(best) : token;
    }

    function smalltalk(text) {
      var words = normalize(text).split(" ").filter(Boolean);
      if (!words.length || words.length > 4) return null;
      var kinds = ["bye", "thanks", "greeting"];
      for (var i = 0; i < kinds.length; i++) {
        var set = SMALLTALK[kinds[i]];
        var own = words.some(function (w) { return set[w]; });
        if (own && words.every(function (w) { return set[w] || STOPWORDS[w]; })) return kinds[i];
      }
      return null;
    }

    function weight(tokens) {
      return tokens.reduce(function (sum, t) { return sum + idf(t); }, 0);
    }

    // Puntaje = qué tanto de la consulta cubre la pregunta (75%) + qué tan completa coincide
    // alguna de sus redacciones (25%); lo segundo desempata preguntas cortas y variantes exactas.
    function rank(text) {
      var query = tokenize(text, fixWord);
      if (!query.length) return [];
      var maxScore = QUESTION_WEIGHT * weight(query);
      return items
        .map(function (entry) {
          var coverage = query.reduce(function (sum, t) {
            if (entry.q[t]) return sum + QUESTION_WEIGHT * idf(t);
            if (entry.a[t]) return sum + ANSWER_WEIGHT * idf(t);
            return sum;
          }, 0) / maxScore;
          var precision = entry.phrasings.reduce(function (best, phrasing) {
            if (!phrasing.length) return best;
            var shared = phrasing.filter(function (t) { return query.indexOf(t) !== -1; });
            return Math.max(best, weight(shared) / weight(phrasing));
          }, 0);
          return { item: entry.item, score: coverage > 0 ? 0.75 * coverage + 0.25 * precision : 0 };
        })
        .filter(function (r) { return r.score > 0; })
        .sort(function (x, y) { return y.score - x.score; });
    }

    function match(text) {
      var talk = smalltalk(text);
      if (talk) return { type: "smalltalk", kind: talk };

      var ranked = rank(text);
      var best = ranked[0];
      var second = ranked[1];
      if (!best || best.score < 0.3) return { type: "fallback" };

      var clearWinner = best.score >= 0.85 || (best.score >= 0.55 && (!second || best.score - second.score >= 0.1));
      if (clearWinner) return { type: "answer", item: best.item, score: best.score };

      return {
        type: "suggest",
        items: ranked.filter(function (r) { return r.score >= 0.25; }).slice(0, 3).map(function (r) { return r.item; })
      };
    }

    return { match: match, rank: rank };
  }

  var api = { create: create, normalize: normalize, tokenize: tokenize };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.TrackiMatcher = api;
})(this);
