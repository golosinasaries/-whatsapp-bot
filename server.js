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

  await axios.post(URL, payload, { headers });
}

async function sendText(to, mensaje) {
  await sendWhatsApp({
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: mensaje }
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
}

async function responderDesdeAdmin(to, tipo, contenido) {
  const payload = {
    messaging_product: "whatsapp",
    to,
    type: tipo
  };

  if (tipo === "text") {
    payload.text = { body: contenido };
  }

  if (tipo === "image") {
    payload.image = { link: contenido };
  }

  if (tipo === "video") {
    payload.video = { link: contenido };
  }

  if (tipo === "audio") {
    payload.audio = { link: contenido };
  }

  if (tipo === "document") {
    payload.document = { link: contenido };
  }

  await sendWhatsApp(payload);

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

async function menu(to) {
  await sendWhatsApp({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "cta_url",
      body: {
        text: "👋 ¡Hola! Bienvenid@ a Golosinas Aries ✨\n\nPodés consultar productos, precios, pagos, envíos, ubicación o cómo comprar.\n\n¿Qué querés ver ahora?"
      },
      action: {
        name: "cta_url",
        parameters: {
          display_text: "Ver catálogo",
          url: "https://golosinasaries.github.io/catalogo"
        }
      }
    }
  });

  await sendWhatsApp({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "cta_url",
      body: {
        text: "💬 Si necesitás ayuda humana."
      },
      action: {
        name: "cta_url",
        parameters: {
          display_text: "Hablar con asesor",
          url: "https://wa.me/542236010443"
        }
      }
    }
  });
}

async function catalogo(to) {
  await sendText(
    to,
    `🛒 Catálogo directo:\nhttps://golosinasaries.github.io/catalogo\n\nSi ya elegiste algo, usá el botón "Hacer pedido" dentro del catálogo.`
  );
}

async function catalogoConGrupo(to) {
  usuariosConsultandoGrupo.add(to);

  await sendText(
    to,
    `***** Todo lo disponible lo encontrás en nuestro catálogo ***** 👇🏻✨

golosinasaries.github.io/catalogo 💖

📢 En caso de nuevos ingresos, lo estaremos anunciando en el grupo.

¿Te gustaría unirte a nuestro grupo de WhatsApp?`
  );
}

async function invitacionGrupo(to) {
  usuariosConsultandoGrupo.delete(to);

  await sendText(
    to,
    `Te invito a sumarte a nuestro grupo de WhatsApp ☺️
${GRUPO_WHATSAPP}`
  );
}

async function comoComprar(to) {
  await sendText(
    to,
    `🛒 Catálogo directo:\nhttps://golosinasaries.github.io/catalogo\n\nSi ya elegiste algo, usá el botón "Hacer pedido" dentro del catálogo.`
  );
}

async function pago(to) {
  await sendText(
    to,
    `💳 El pago se realiza por transferencia antes del envío.\n\nPodés ver referencias acá 👇\n\n👉 Facebook:\nhttps://www.facebook.com/profile.php?id=61578949001641\n\n👉 Instagram:\nhttps://www.instagram.com/golosinasaries`
  );
}

async function envios(to) {
  await sendText(
    to,
    `🚚 Realizamos envíos a todo el país.\n\nTrabajamos con Correo Argentino y otros medios según la zona.\n\nDecime de dónde sos y te ayudo 😊`
  );
}

async function ubicacion(to) {
  await sendText(
    to,
    `📍 Estamos en Miramar, Buenos Aires.\n\nHacemos envíos a todo el país 🇦🇷`
  );
}

async function demora(to) {
  await sendText(
    to,
    `⏱️ Se enviaría por Correo Argentino 📦 y llega en 2 - 5 días hábiles.\n\nLink para realizar el pedido 👇✨\nhttps://golosinasaries.github.io/catalogo`
  );
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
          url: "https://wa.me/542236010443"
        }
      }
    }
  });
}

function manejarTextoCliente(from, textoCliente) {
  if (!textoCliente) return;

  if (usuariosAsesor.has(from)) return;

  if (usuariosConsultandoGrupo.has(from)) {
    if (containsAny(textoCliente, ["si", "sí", "quiero", "sumarme", "unirme", "dale"])) {
      return invitacionGrupo(from);
    }

    if (containsAny(textoCliente, ["no", "gracias", "nah", "no quiero"])) {
      usuariosConsultandoGrupo.delete(from);
      return sendText(from, "No hay problema 😊");
    }
  }

  const menuTriggers = ["menu", "inicio", "volver", "principio"];
  if (containsAny(textoCliente, menuTriggers)) {
    return menu(from);
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
    return catalogoConGrupo(from);
  }

  if (
    containsAny(textoCliente, [
      "comprar",
      "pedido",
      "quiero comprar",
      "hacer pedido",
      "como compro",
      "como comprar",
      "como hago",
      "quiero un pedido",
      "hacer compra"
    ])
  ) {
    return catalogo(from);
  }

  if (
    containsAny(textoCliente, [
      "pago",
      "transferencia",
      "alias",
      "deposito",
      "deposito bancario",
      "depósito"
    ])
  ) {
    return pago(from);
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
    return envios(from);
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
    return ubicacion(from);
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
    return demora(from);
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
    return asesor(from);
  }

  return sendText(
    from,
    `😅 No entendí bien tu consulta, pero podés elegir una opción:

🛒 Ver catálogo
📦 Cómo comprar
💳 Pagos
🚚 Envíos
📍 Ubicación

Escribí 'menú' para volver al inicio 😊`
  );
}

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
      return;
    }

    if (!usuariosIniciados.has(from)) {
      usuariosIniciados.add(from);
      await menu(from);
      return;
    }

    await manejarTextoCliente(from, textoCliente);
  }

  if (message.type === "interactive") {
    const id = message.interactive?.button_reply?.id;

    if (id === "catalogo") {
      await catalogo(from);
      return;
    }

    if (id === "comprar") {
      await comoComprar(from);
      return;
    }

    if (id === "asesor") {
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

    if (id === "menu") {
      await menu(from);
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
      }
      .cliente {
        padding: 12px;
        border-bottom: 1px solid #ddd;
      }
      .cliente a {
        text-decoration: none;
        color: #222;
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
      }
      .burbuja {
        padding: 10px;
        margin: 10px;
        border-radius: 10px;
        max-width: 65%;
        word-break: break-word;
      }
      .entrada {
        background: white;
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
      }
      button {
        padding: 12px 16px;
        cursor: pointer;
      }
    </style>
  </head>
  <body>
    <div id="clientes">
      <h2>Clientes</h2>
      ${clientesHTML}
    </div>

    <div id="chat">
      <h2>${escapeHTML(cliente)}</h2>

      <div class="mensajes">
        ${mensajesHTML}
      </div>

      <textarea id="mensaje" placeholder="Escribir mensaje..."></textarea>
      <button onclick="enviar()">Enviar</button>
    </div>

    <script>
      async function enviar() {
        const mensaje = document.getElementById("mensaje").value;
        if (!mensaje.trim()) return;

        await fetch("/responder", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            to: "${escapeHTML(cliente)}",
            mensaje
          })
        });

        location.reload();
      }
    </script>
  </body>
  </html>
  `;

  res.send(html);
});

app.post("/responder", async (req, res) => {
  const { to, mensaje, tipo = "text" } = req.body;

  if (!to || !mensaje) {
    return res.status(400).json({ error: "Faltan datos" });
  }

  try {
    await responderDesdeAdmin(to, tipo, mensaje);
    res.json({ ok: true });
  } catch (error) {
    console.log("Error al responder:", error.response?.data || error.message || error);
    res.status(500).json({ error: "No se pudo enviar" });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Bot funcionando en el puerto ${PORT}`);
}).on("error", (err) => {
  console.log("Error arrancando servidor:", err);
});