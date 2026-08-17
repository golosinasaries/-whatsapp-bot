const express = require("express");
const axios = require("axios");
const fs = require("fs");
require("dotenv").config();

const app = express();
app.use(express.json());

const ARCHIVO = "./conversaciones.json";
const NUMERO_VENTAS = "2236010443";

const BOT_NAME = "Golosinas Aries";
const GRUPO_WHATSAPP = "https://chat.whatsapp.com/Gvuz6sIsH1a4IssI5lAMad";

const usuariosConsultandoGrupo = new Set();
const usuariosIniciados = new Set();
const usuariosAsesor = new Set();
const usuariosContadores = new Map();
const usuariosOpciones = new Map();
const usuariosEstado = new Map();

const opcionesAleatorias = [
  {
    id: "envio",
    titulo: "🚚 Cómo es el envío"
  },
  {
    id: "costo_envio",
    titulo: "📦 Costo del envío"
  },
  {
    id: "demora",
    titulo: "⏱️ Demora de envío"
  },
  {
    id: "pago",
    titulo: "💳 Formas de pago"
  },
  {
    id: "pago_cnc",
    titulo: "💳 Pago con tarjeta"
  },
  {
    id: "compra_minima",
    titulo: "💰 Compra mínima"
  },
  {
    id: "ubicacion",
    titulo: "📍 De dónde somos"
  }
];

const usuariosUltimaActividad = new Map(); 
const usuariosNotificadosInactividad = new Set(); 
const timersInactividad = new Map();

function activarInactividad(from) {

  if (timersInactividad.has(from)) {
    clearTimeout(timersInactividad.get(from));
  }

  const timer = setTimeout(async () => {

    await seguimientoInactividad(from);

    timersInactividad.delete(from);

  }, 30 * 60 * 1000);

  timersInactividad.set(from, timer);
}

function normalizeText(text = "") {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function escapeHTML(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function cargarConversaciones() {
  if (!fs.existsSync(ARCHIVO)) {
    fs.writeFileSync(ARCHIVO, "[]");
  }

  try {
    return JSON.parse(fs.readFileSync(ARCHIVO, "utf8"));
  } catch (error) {
    console.log("Error leyendo conversaciones.json. Se reinicia.");
    fs.writeFileSync(ARCHIVO, "[]");
    return [];
  }
}

function guardarConversaciones(datos) {
  fs.writeFileSync(ARCHIVO, JSON.stringify(datos, null, 2));
}

let mensajes = cargarConversaciones();

function fechaISO() {
  return new Date().toISOString();
}

function registrarMensaje({
  from,
  tipo = "text",
  texto = "",
  estado = "bot",
  direccion = "entrada"
}) {
  mensajes.push({
    from,
    tipo,
    texto,
    fecha: fechaISO(),
    estado,
    direccion
  });

  guardarConversaciones(mensajes);
}

async function sendWhatsApp(payload) {
  const URL = `https://graph.facebook.com/v23.0/${process.env.PHONE_NUMBER_ID}/messages`;
  const headers = {
    Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
    "Content-Type": "application/json"
  };

  console.log(`📡 POST a ${URL}`);
  console.log(`📦 Payload:`, JSON.stringify(payload, null, 2));

  try {

    console.log("TOKEN:", process.env.WHATSAPP_TOKEN?.slice(0,20));
    console.log("PHONE:", process.env.PHONE_NUMBER_ID);
    const response = await axios.post(URL, payload, { headers });
    console.log(`✅ Respuesta WhatsApp:`, response.data);
    return response.data;
  } catch (error) {
    console.log(JSON.stringify(error.response?.data,null,2));
    console.error(`❌ Error WhatsApp API:`, error.response?.data || error.message);
    throw error;
  }
}

async function sendText(to, mensaje) {
  await sendWhatsApp({
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: mensaje }
  });

  registrarMensaje({
    from: to,
    tipo: "text",
    texto: mensaje,
    estado: "bot",
    direccion: "salida"
  });
}

async function sendButtonMenu(to, body, buttons) {
  await sendWhatsApp({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body },
      action: {
        buttons: buttons.map((button) => ({
          type: "reply",
          reply: {
            id: button.id,
            title: button.title
          }
        }))
      }
    }
  });

  registrarMensaje({
    from: to,
    tipo: "interactive",
    texto: body,
    estado: "bot",
    direccion: "salida"
  });
}

async function responderDesdeAdmin(to, tipo, contenido) {
  console.log(`\n🔍 Preparando respuesta desde admin`);
  console.log(`   to: ${to}`);
  console.log(`   tipo: ${tipo}`);
  console.log(`   contenido: ${contenido}`);

  if (!to || !contenido) {
    throw new Error("Faltan parámetros: to o contenido");
  }

  const payload = {
    messaging_product: "whatsapp",
    to: String(to).trim(),
    type: tipo
  };

  if (tipo === "text") {
    payload.text = { body: String(contenido) };
  } else if (tipo === "image") {
    payload.image = { link: String(contenido) };
  } else if (tipo === "video") {
    payload.video = { link: String(contenido) };
  } else if (tipo === "audio") {
    payload.audio = { link: String(contenido) };
  } else if (tipo === "document") {
    payload.document = { link: String(contenido) };
  }

  console.log(`📤 Llamando sendWhatsApp...`);
  await sendWhatsApp(payload);
  console.log(`✅ Mensaje registrado en base de datos`);

  registrarMensaje({
    from: to,
    tipo,
    texto: contenido,
    estado: "humano",
    direccion: "salida"
  });
}

function containsAny(text, list) {
  return list.some((item) => text.includes(item));
}


// ===== MENÚS =====
async function menu(to) {
  await sendWhatsApp({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: {
        text: "👋 ¡Hola! Bienvenid@ a Golosinas Aries ✨\n\n¿En qué te puedo ayudar?"
      },
      action: {
        buttons: [
          {
            type: "reply",
            reply: {
              id: "catalogo",
              title: "🛒 Ver productos"
            }
          }
        ]
      }
    }
  });

  registrarMensaje({
    from: to,
    tipo: "interactive",
    texto: "Menú bienvenida",
    estado: "bot",
    direccion: "salida"
  });
}

async function menuDinamico(to) {
  const opciones = usuariosOpciones.get(to) || new Set();
  const botones = [
    {
      type: "url",
      text: "🛒 Ver productos",
      url: "https://golosinasaries.github.io/catalogo"
    },
    {
      type: "reply",
      reply: {
        id: "envio",
        title: "🚚 Cómo es el envío"
      }
    },
    {
      type: "reply",
      reply: {
        id: "ubicacion",
        title: "📍 De dónde somos"
      }
    }
  ];

  if (opciones.has("catalogo")) {
    botones.push({
      type: "reply",
      reply: {
        id: "compra_minima",
        title: "💰 Compra mínima"
      }
    });
  }

  if (opciones.has("envio")) {
    botones.push({
      type: "reply",
      reply: {
        id: "costo_envio",
        title: "📦 Costo del envío"
      }
    });
    botones.push({
      type: "reply",
      reply: {
        id: "demora",
        title: "⏱️ Demora de envío"
      }
    });
  }

  if (opciones.has("pago")) {
    botones.push({
      type: "reply",
      reply: {
        id: "pago_cnc",
        title: "💳 Pago con tarjeta"
      }
    });
  }

  const contador = usuariosContadores.get(to) || 0;
  if (contador >= 3) {
    botones.push({
      type: "reply",
      reply: {
        id: "asesor",
        title: "💬 Hablar con asesor"
      }
    });
  }

  await sendWhatsApp({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: {
        text: "¿En qué más te puedo ayudar?"
      },
      action: {
        buttons: botones
      }
    }
  });

  registrarMensaje({
    from: to,
    tipo: "interactive",
    texto: "Menú dinámico",
    estado: "bot",
    direccion: "salida"
  });
}

// ===== RESPUESTAS =====

async function seguimientoInactividad(to) {

  await sendText(
    to,
    `😊 ¿Pudiste ver nuestro catálogo?\n\n🛒 Te lo dejo nuevamente por acá 👇✨\ngolosinasaries.github.io/catalogo`
  );

  await sendWhatsApp({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: {
        text: "¿Necesitás ayuda?"
      },
      action: {
        buttons: [
          {
            type: "url",
            text: "🛒 Ver productos",
            url: "https://golosinasaries.github.io/catalogo"
          },
          {
            type: "reply",
            reply: {
              id: "asesor",
              title: "💬 Hablar con asesor"
            }
          }
        ]
      }
    }
  });

}

async function compraMinima(to) {
  const opciones = usuariosOpciones.get(to) || new Set();
  opciones.add("compra_minima");
  usuariosOpciones.set(to, opciones);

  await sendText(to, `💰 La compra mínima es de $50.000.`);
  await botonesSiguientes(to);
}

async function costoEnvio(to) {
  await sendText(
    to,
    `📍 Para saber el valor del envío hasta tu localidad 🚚\n\n🛒 Ingresá a nuestra tienda online 👇\ngolosinasaries.github.io/catalogo\n\n☰ En el menú de las tres rayitas vas a encontrar la opción *"Costo de envío"*, donde podés consultar el valor según tu localidad 📦`
  );
  await botonesSiguientes(to);
}

async function pago(to) {
  const opciones = usuariosOpciones.get(to) || new Set();
  opciones.add("pago");
  usuariosOpciones.set(to, opciones);

  await sendText(
    to,
    `💳 El pago se realiza por transferencia antes del envío\n\nPodés ver algunas referencias acá 👇\n\n👉 *Facebook:* https://www.facebook.com/profile.php?id=61578949001641\n👉 *Instagram:* https://www.instagram.com/golosinasaries\n\n😄 *Seguinos* 💖\n👉 *Facebook:* https://www.facebook.com/profile.php?id=61577104861271\n👉 *Instagram:* https://www.instagram.com/golosinasaries`
  );
  await botonesSiguientes(to);
}

async function pagoCNC(to) {
  await sendText(
    to,
    `💳 Podés pagar con tarjeta de crédito 💳, pero tené en cuenta que se aplica un recargo del 10% sobre el total de tu compra.`
  );
  await botonesSiguientes(to);
}

async function envios(to) {
  const opciones = usuariosOpciones.get(to) || new Set();
  opciones.add("envio");
  usuariosOpciones.set(to, opciones);

  await sendText(
    to,
    `🚚 Realizamos envíos a todo el país.\n\nTrabajamos con Correo Argentino y otros medios según la zona.\n\nDecime de dónde sos y te ayudo 😊`
  );
  await botonesSiguientes(to);
}

async function ubicacion(to) {
  const opciones = usuariosOpciones.get(to) || new Set();
  opciones.add("ubicacion");
  usuariosOpciones.set(to, opciones);

  await sendText(
    to,
    `📍 Estamos en Miramar, Buenos Aires.\n\nHacemos envíos a todo el país 🇦🇷`
  );
  await botonesSiguientes(to);
}

async function demora(to) {
  await sendText(
    to,
    `⏱️ Se enviaría por Correo Argentino 📦 y llega en 2 - 5 días hábiles.\n\nLink para realizar el pedido 👇✨\nhttps://golosinasaries.github.io/catalogo`
  );
  await botonesSiguientes(to);
}

async function asesor(to) {
  usuariosAsesor.add(to);

  await sendWhatsApp({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "cta_url",
      body: {
        text: "Perfecto 😊\n\nTe llevamos directo al chat del asesor."
      },
      action: {
        name: "cta_url",
        parameters: {
          display_text: "Hablar con asesor",
          url: `https://wa.me/54${NUMERO_VENTAS}?text=Quiero%20hablar%20con%20un%20asesor%20de%20Golosinas%20Aries`
        }
      }
    }
  });

  registrarMensaje({
    from: to,
    tipo: "interactive",
    texto: "Redirigido a asesor",
    estado: "bot",
    direccion: "salida"
  });
}

async function catalogoConGrupo(to) {
  const opciones = usuariosOpciones.get(to) || new Set();
  opciones.add("catalogo");
  opciones.add("pago");
  usuariosOpciones.set(to, opciones);

  usuariosConsultandoGrupo.add(to);

  await sendText(
    to,
    `***** Todo lo disponible lo encontrás en nuestro catálogo ***** 👇🏻✨\n\ngolosinasaries.github.io/catalogo 💖\n\n📢 En caso de nuevos ingresos, lo estaremos anunciando en el grupo.\n\n¿Te gustaría unirte a nuestro grupo de WhatsApp?`
  );
  
  await sendButtonMenu(to, "¿En qué más te puedo ayudar?", [
    { id: "envio", title: "🚚 Cómo es el envío" },
    { id: "ubicacion", title: "📍 De dónde somos" },
    { id: "pago", title: "💳 Formas de pago" }
  ]);
}

async function invitacionGrupo(to) {
  usuariosConsultandoGrupo.delete(to);

  await sendText(
    to,
    `Buenísimo 🙌✨\n\nTe invito a sumarte a nuestro grupo de WhatsApp ☺️\n${GRUPO_WHATSAPP}`
  );
  
  await botonesSiguientes(to);
}

async function botonesSiguientes(to) {
  const opciones = usuariosOpciones.get(to) || new Set();
  const botones = [
  {
    type: "url",
    text: "🛒 Ver productos",
    url: "https://golosinasaries.github.io/catalogo"
  },
  {
    type: "url",
    text: "📢 Unirme al grupo",
    url: GRUPO_WHATSAPP

  }
];

  const usadas = usuariosOpciones.get(to) || new Set();

  let disponibles = opcionesAleatorias.filter(
    (opcion) => !usadas.has(opcion.id)
  );

  disponibles = disponibles.sort(() => Math.random() - 0.5);

  const elegir = disponibles.slice(0, 3);

  elegir.forEach((opcion) => {
    botones.push({
      type: "reply",
      reply: {
        id: opcion.id,
        title: opcion.titulo
      }
    });
  });

  if (opciones.has("envio")) {
    botones.push({
      type: "reply",
      reply: {
        id: "costo_envio",
        title: "📦 Costo del envío"
      }
    });
    botones.push({
      type: "reply",
      reply: {
        id: "demora",
        title: "⏱️ Demora de envío"
      }
    });
  }

  if (opciones.has("pago")) {
    botones.push({
      type: "reply",
      reply: {
        id: "pago_cnc",
        title: "💳 Pago con tarjeta"
      }
    });
  }

  if (!opciones.has("envio") && !opciones.has("catalogo")) {
    botones.push({
      type: "reply",
      reply: {
        id: "envio",
        title: "🚚 Cómo es el envío"
      }
    });
    botones.push({
      type: "reply",
      reply: {
        id: "ubicacion",
        title: "📍 De dónde somos"
      }
    });
  }

  const contador = usuariosContadores.get(to) || 0;
  if (contador >= 3) {
    botones.pop();
    botones.push({
      type: "reply",
      reply: {
        id: "asesor",
        title: "💬 Hablar con asesor"
      }
    });
  }

  const botonesFinal = botones.slice(0, 3);

  await sendWhatsApp({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: {
        text: "¿En qué más te puedo ayudar?"
      },
      action: {
        buttons: botonesFinal
      }
    }
  });

  registrarMensaje({
    from: to,
    tipo: "interactive",
    texto: "Botones siguientes",
    estado: "bot",
    direccion: "salida"
  });
}

async function manejarTextoCliente(from, textoCliente) {
  if (!textoCliente) return;

  if (timersInactividad.has(from)) {
    clearTimeout(timersInactividad.get(from));
    timersInactividad.delete(from);
  }

  const estado = usuariosEstado.get(from);

  if (estado === "provincia") {
    usuariosEstado.set(from, "comercio");

    await sendText(
      from,
      `Genial, hacemos envíos por Correo Argentino y llegaría en 2 - 5 días hábiles. 📦🙌\n\n¿Tenés kiosco, comercio o algún evento?`
    );

    activarInactividad(from);

    return;
  }

  if (estado === "comercio") {

    if (
      containsAny(textoCliente, [
        "kiosco",
        "quiosco",
        "kiosko",
        "comercio",
        "negocio",
        "local",
        "emprendimiento",
        "emprender",
        "emprendo",
        "empezando",
        "empezando con esto",
        "estoy empezando",
        "arrancando",
        "voy a empezar",
        "probando",
        "estoy probando",
        "vendo",
        "revendo",
        "revendedor",
        "venta",
        "ventas",
        "tengo un puesto",
        "tengo un local",
        "tengo negocio",
        "soy comerciante",
        "si",
        "sí"
      ])
    ) {
      usuariosEstado.delete(from);

      await invitacionGrupo(from);
      return;
    }

    if (
      containsAny(textoCliente, [
        "evento",
        "fiesta",
        "cumple",
        "cumpleaños"
      ])
    ) {
      usuariosEstado.delete(from);

      await sendText(
        from,
        `¡Buenísimo! 🎉 Tenemos muchas opciones ideales para eventos.\n\nPodés ver todos nuestros productos acá 👇✨\ngolosinasaries.github.io/catalogo`
      );

      await botonesSiguientes(from);
      return;
    }
  }

  if (usuariosAsesor.has(from)) {
    usuariosAsesor.delete(from);
  }

  const contador = (usuariosContadores.get(from) || 0) + 1;
  usuariosContadores.set(from, contador);

  if (usuariosConsultandoGrupo.has(from)) {
    if (containsAny(textoCliente, ["si", "sí", "quiero", "sumarme", "unirme", "dale"])) {
      return await invitacionGrupo(from);
    }

    if (containsAny(textoCliente, ["no", "gracias", "nah", "no quiero"])) {
      usuariosConsultandoGrupo.delete(from);
      await sendText(from, "No hay problema 😊");
      await botonesSiguientes(from);
      return;
    }
  }

  const menuTriggers = ["menu", "inicio", "volver", "principio"];
  if (containsAny(textoCliente, menuTriggers)) {
    return await menuDinamico(from);
  }

  if (
    containsAny(textoCliente, [
      "compra minima",
      "compra mínima",
      "cuanto es la compra minima",
      "cuál es la compra mínima",
      "cual es la compra minima",
      "cuánto es la compra mínima"
    ])
  ) {
    return await compraMinima(from);
  }

  if (
    containsAny(textoCliente, [
      "costo envio",
      "costo de envio",
      "precio del envio",
      "cuanto sale el envio",
      "cuánto sale el envío",
      "envio hasta mi localidad",
      "valor del envio"
    ])
  ) {
    return await costoEnvio(from);
  }

  if (
    containsAny(textoCliente, [
      "catalogo",
      "catálogo",
      "productos",
      "precio",
      "precios",
      "ver catalogo",
      "ver catálogo",
      "tenemos algo",
      "tenes algo",
      "tienen algo",
      "tienen productos",
      "hay algo",
      "hay stock",
      "que tienen",
      "qué tienen",
      "disponible",
      "estan disponibles"
    ])
  ) {
    return await catalogoConGrupo(from);
  }

  if (
    containsAny(textoCliente, [
      "pago",
      "transferencia",
      "formas de pago"
    ])
  ) {
    return await pago(from);
  }

  if (
    containsAny(textoCliente, [
      "tarjeta",
      "recargo",
      "pago con tarjeta"
    ])
  ) {
    return await pagoCNC(from);
  }

  if (
    containsAny(textoCliente, [
      "envio",
      "envios",
      "envíos",
      "correo",
      "entrega",
      "envio a"
    ])
  ) {
    return await envios(from);
  }

  if (
    containsAny(textoCliente, [
      "donde",
      "dónde",
      "ubicacion",
      "ubicación",
      "miramar",
      "direccion",
      "dirección"
    ])
  ) {
    return await ubicacion(from);
  }

  if (
    containsAny(textoCliente, [
      "demora",
      "cuanto tarda",
      "cuánto tarda",
      "tiempo",
      "tarda"
    ])
  ) {
    return await demora(from);
  }

  if (
    containsAny(textoCliente, [
      "asesor",
      "persona",
      "humano",
      "vendedor",
      "ayuda",
      "hablar con alguien",
      "necesito ayuda",
      "consultar"
    ])
  ) {
    return await asesor(from);
  }

  await sendText(
    from,
    `😅 No entendí bien tu consulta, pero podés escribir:\n\n🛒 Productos\n🚚 Envíos\n📍 Ubicación\n\nO escribí 'menú' para volver al inicio 😊`
  );
  await botonesSiguientes(from);
}

// ===== RUTAS =====
app.get("/health", (req, res) => {
  res.json({ ok: true, bot: BOT_NAME });
});

app.get("/webhook", (req, res) => {
  if (req.query["hub.verify_token"] === process.env.VERIFY_TOKEN) {
    return res.send(req.query["hub.challenge"]);
  }

  res.sendStatus(403);
});

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  console.log("LLEGO WEBHOOK");
  console.log(JSON.stringify(req.body, null, 2));

  const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!message) return;

  const from = message.from;

  if (
    message.type === "text" ||
    message.type === "image" ||
    message.type === "audio" ||
    message.type === "document" ||
    message.type === "video"
  ) {
    let contenido = "";
    const tipo = message.type;

    if (message.type === "text") {
      contenido = message.text?.body || "";
    }

    if (message.type === "image") contenido = "📷 Imagen recibida";
    if (message.type === "audio") contenido = "🎤 Audio recibido";
    if (message.type === "document") contenido = "📄 Documento recibido";
    if (message.type === "video") contenido = "🎥 Video recibido";

    registrarMensaje({
      from,
      tipo,
      texto: contenido,
      estado: usuariosAsesor.has(from) ? "humano" : "bot",
      direccion: "entrada"
    });

    console.log(`Mensaje ${tipo} de ${from}: ${contenido}`);

    if (message.type !== "text") {
      return;
    }

    const textoCliente = normalizeText(message.text?.body || "");

    if (!textoCliente) {
      await sendText(from, "No recibí texto. Escribí tu consulta y te ayudo 😊");
      await botonesSiguientes(from);
      return;
    }

    if (!usuariosIniciados.has(from)) {
      usuariosIniciados.add(from);
      usuariosEstado.delete(from);
      await menu(from);
      return;
    }

    await manejarTextoCliente(from, textoCliente);
  }

  if (message.type === "interactive") {
    const id = message.interactive?.button_reply?.id;

    if (id && id !== "menu") {
      const contador = (usuariosContadores.get(from) || 0) + 1;
      usuariosContadores.set(from, contador);
      console.log(`Contador ${from}: ${contador}`);
    }

    if (id === "compra_minima") {
      await compraMinima(from);
      return;
    }

    if (id === "costo_envio") {
      await costoEnvio(from);
      return;
    }

    if (id === "asesor") {
      const contador = usuariosContadores.get(from) || 0;
      if (contador < 3) {
        await sendText(from, "Por favor respondé más preguntas primero 😊");
        await botonesSiguientes(from);
        return;
      }
      await asesor(from);
      return;
    }

    if (id === "pago") {
      await pago(from);
      return;
    }

    if (id === "envio") {
      await envios(from);
      return;
    }

    if (id === "ubicacion") {
      await ubicacion(from);
      return;
    }

    if (id === "demora") {
      await demora(from);
      return;
    }

    if (id === "pago_cnc") {
      await pagoCNC(from);
      return;
    }

    if (id === "menu") {
      await menuDinamico(from);
      return;
    }
  }
});

app.get("/mensajes", (req, res) => {
  res.json(mensajes);
});

function protegerAdmin(req, res, next) {
  const auth = req.headers.authorization;

  if (!auth) {
    res.setHeader("WWW-Authenticate", "Basic");
    return res.status(401).send("Necesita autorización");
  }

  const parte = auth.split(" ")[1];
  const decoded = Buffer.from(parte, "base64").toString("utf8");
  const [usuario, ...rest] = decoded.split(":");
  const clave = rest.join(":");

  if (
    usuario === process.env.ADMIN_USER &&
    clave === process.env.ADMIN_PASSWORD
  ) {
    return next();
  }

  res.status(403).send("Acceso denegado");
}

app.get("/admin", protegerAdmin, (req, res) => {
  const clientes = [...new Set(mensajes.map((m) => m.from))];
  const cliente = req.query.cliente || clientes[0] || "";
  const conversacion = mensajes.filter((m) => m.from === cliente);

  const clientesHTML = clientes
    .map(
      (c) => `
        <div class="cliente">
          <a href="/admin?cliente=${encodeURIComponent(c)}">${escapeHTML(c)}</a>
        </div>
      `
    )
    .join("");

  const mensajesHTML = conversacion
    .map(
      (m) => `
        <div class="burbuja ${m.direccion}">
          ${escapeHTML(m.texto)}
          <br>
          <small>${escapeHTML(m.fecha)}</small>
        </div>
      `
    )
    .join("");

  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8" />
    <title>${BOT_NAME} - Admin</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        margin: 0;
        display: flex;
        height: 100vh;
        background: #f2f2f2;
      }
      #clientes {
        width: 300px;
        background: white;
        border-right: 1px solid #ccc;
        padding: 15px;
        overflow: auto;
        display: flex;
        flex-direction: column;
      }
      #nuevo-cliente {
        margin-bottom: 15px;
        padding-bottom: 15px;
        border-bottom: 2px solid #ccc;
      }
      #nuevo-cliente input {
        width: 100%;
        padding: 8px;
        margin-bottom: 8px;
        box-sizing: border-box;
      }
      #nuevo-cliente button {
        width: 100%;
        padding: 10px;
        background: #25d366;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-weight: bold;
      }
      #nuevo-cliente button:hover {
        background: #1fa952;
      }
      .cliente {
        padding: 12px;
        border-bottom: 1px solid #ddd;
        cursor: pointer;
      }
      .cliente a {
        text-decoration: none;
        color: #222;
      }
      .cliente:hover {
        background: #f0f0f0;
      }
      #chat {
        flex: 1;
        display: flex;
        flex-direction: column;
        padding: 20px;
      }
      .mensajes {
        flex: 1;
        overflow: auto;
        margin-bottom: 15px;
        border: 1px solid #ddd;
        padding: 10px;
        background: white;
      }
      .burbuja {
        padding: 10px;
        margin: 5px 0;
        border-radius: 10px;
        max-width: 65%;
        word-break: break-word;
      }
      .entrada {
        background: #f0f0f0;
      }
      .salida {
        background: #dff7d7;
        margin-left: auto;
      }
      textarea {
        width: 100%;
        min-height: 80px;
        margin-bottom: 10px;
        resize: vertical;
        box-sizing: border-box;
        padding: 10px;
      }
      button {
        padding: 12px 16px;
        cursor: pointer;
        background: #25d366;
        color: white;
        border: none;
        border-radius: 5px;
        font-weight: bold;
      }
      button:hover {
        background: #1fa952;
      }
      #status {
        margin-top: 10px;
        font-size: 12px;
      }
      .error {
        color: red;
      }
      .success {
        color: green;
      }
    </style>
  </head>
  <body>
    <div id="clientes">
      <div id="nuevo-cliente">
        <h3>Nuevo cliente</h3>
        <input type="text" id="numeroNuevo" placeholder="Ingresa el número (ej: 5491234567890)">
        <button onclick="irAlCliente()">Ir al cliente</button>
      </div>
      <h3>Clientes previos (${clientes.length})</h3>
      ${clientesHTML || "<p>Sin clientes</p>"}
    </div>

    <div id="chat">
      <h2>${escapeHTML(cliente) || "Selecciona un cliente"}</h2>

      <div class="mensajes">
        ${mensajesHTML || "<p>Sin mensajes</p>"}
      </div>

      ${cliente ? `
        <textarea id="mensaje" placeholder="Escribir mensaje..." autofocus></textarea>
        <button onclick="enviar()">Enviar</button>
        <div id="status"></div>
      ` : "<p style='color: gray;'>Selecciona un cliente o ingresa uno nuevo para enviar mensajes</p>"}
    </div>

    <script>
      function irAlCliente() {
        const numero = document.getElementById("numeroNuevo").value.trim();
        if (!numero) {
          alert("Ingresa un número válido");
          return;
        }
        window.location.href = "/admin?cliente=" + encodeURIComponent(numero);
      }

      async function enviar() {
        const mensaje = document.getElementById("mensaje").value.trim();
        const status = document.getElementById("status");
        
        if (!mensaje) {
          status.innerHTML = '<p class="error">El mensaje no puede estar vacío</p>';
          return;
        }

        try {
          status.innerHTML = '<p>⏳ Enviando...</p>';
          
          const response = await fetch("/responder", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              to: "${escapeHTML(cliente)}",
              mensaje: mensaje
            })
          });

          const data = await response.json();

          if (response.ok) {
            status.innerHTML = '<p class="success">✅ Mensaje enviado correctamente</p>';
            document.getElementById("mensaje").value = "";
            setTimeout(() => location.reload(), 1500);
          } else {
            status.innerHTML = '<p class="error">❌ Error: ' + (data.error || "Desconocido") + '</p>';
            console.error("Error response:", data);
          }
        } catch (err) {
          status.innerHTML = '<p class="error">❌ Error de conexión: ' + err.message + '</p>';
          console.error("Network error:", err);
        }
      }

      document.addEventListener("DOMContentLoaded", function() {
        const textarea = document.getElementById("mensaje");
        if (textarea) {
          textarea.addEventListener("keydown", function(e) {
            if (e.key === "Enter") {
              e.preventDefault();
              enviar();
            }
          });
        }
      });
    </script>
  </body>
  </html>
  `;

  res.send(html);
});

app.post("/responder", async (req, res) => {
  const { to, mensaje, tipo = "text" } = req.body;

  console.log(`\n📨 === NUEVO RESPONDER ===`);
  console.log(`📤 Admin intenta responder a: ${to}`);
  console.log(`💬 Mensaje: ${mensaje}`);
  console.log(`📋 Tipo: ${tipo}`);

  if (!to || !mensaje) {
    console.error("❌ ERROR: Faltan datos");
    return res.status(400).json({ error: "Faltan datos: to y mensaje son requeridos" });
  }

  try {
    console.log(`🚀 Llamando responderDesdeAdmin...`);
    await responderDesdeAdmin(to, tipo, mensaje);
    
    console.log(`✅ ÉXITO: Respuesta enviada a ${to}`);
    res.json({ ok: true, message: "Mensaje enviado correctamente" });
  } catch (error) {
    console.error(`\n❌ ERROR COMPLETO:`);
    console.error(`   Mensaje: ${error.message}`);
    console.error(`   Status: ${error.response?.status}`);
    console.error(`   Data: ${JSON.stringify(error.response?.data)}`);
    
    res.status(500).json({ 
      error: "No se pudo enviar el mensaje",
      details: error.message,
      whatsapp_error: error.response?.data?.error?.message
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Bot funcionando en el puerto ${PORT}`);
}).on("error", (err) => {
  console.log("Error arrancando servidor:", err);
});