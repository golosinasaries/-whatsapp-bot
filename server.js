const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(express.json());

app.get("/webhook", (req, res) => {
  if (req.query["hub.verify_token"] === process.env.VERIFY_TOKEN) {
    return res.send(req.query["hub.challenge"]);
  }

  res.sendStatus(403);
});

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  const message =
    req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

  if (!message) return;

  const from = message.from;

  // Cualquier mensaje de texto muestra el menú
  if (message.type === "text") {
    await menu(from);
  }

  // Botones
  if (message.type === "interactive") {
    const id = message.interactive.button_reply?.id;

    // Ver catálogo
    if (id === "catalogo") {
      await texto(
        from,
        "🛒 ¡Claro! Acá podés ver todos nuestros productos:\n\nhttps://golosinasaries.github.io/catalogo\n\n🇦🇷 Enviamos a todo el país."
      );
    }

    // Pregunta de origen + botones
    if (id === "origen") {
      await preguntaComercio(from);
    }

    // Tiene comercio
    if (id === "comercio") {
      await texto(
        from,
        "¡Buenísimo! 🙌✨\n\nTe invito a sumarte a nuestro grupo de WhatsApp ☺️\n\nhttps://chat.whatsapp.com/Gvuz6sIsH1a4IssI5lAMad"
      );
    }

    // No tiene comercio
    if (id === "particular") {
      await texto(
        from,
        "¡Perfecto! 😊\n\nPodés ver todos nuestros productos en el catálogo:\n\nhttps://golosinasaries.github.io/catalogo\n\n🇦🇷 Hacemos envíos a todo el país."
      );
    }
  }
});


// MENÚ PRINCIPAL
async function menu(to) {
  await axios.post(
    `https://graph.facebook.com/v23.0/${process.env.PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "button",

        body: {
          text:
            "👋 ¡Hola! Bienvenid@ a Golosinas Aries ♈🔥\n\n🇦🇷 Enviamos a todo el país\n📍 Desde Miramar, Buenos Aires\n\n¿Qué querés hacer?"
        },

        action: {
          buttons: [
            {
              type: "reply",
              reply: {
                id: "catalogo",
                title: "🛒 Ver catálogo"
              }
            },
            {
              type: "reply",
              reply: {
                id: "origen",
                title: "📍 ¿De dónde son?"
              }
            },
            {
              type: "reply",
              reply: {
                id: "comercio",
                title: "🏪 Tengo comercio"
              }
            }
          ]
        }
      }
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json"
      }
    }
  );
}


// PREGUNTA CON OPCIONES
async function preguntaComercio(to) {
  await axios.post(
    `https://graph.facebook.com/v23.0/${process.env.PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      type: "interactive",

      interactive: {
        type: "button",

        body: {
          text:
            "📍 Somos de Miramar, Buenos Aires.\n\n🇦🇷 Hacemos envíos a todo el país por Correo Argentino y el pedido suele llegar en 2 a 5 días hábiles.\n\n🏪 ¿Tenés kiosco o comercio?"
        },

        action: {
          buttons: [
            {
              type: "reply",
              reply: {
                id: "comercio",
                title: "🏪 Sí, tengo comercio"
              }
            },
            {
              type: "reply",
              reply: {
                id: "particular",
                title: "👤 Soy particular"
              }
            }
          ]
        }
      }
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json"
      }
    }
  );
}


// MENSAJE DE TEXTO
async function texto(to, mensaje) {
  await axios.post(
    `https://graph.facebook.com/v23.0/${process.env.PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: {
        body: mensaje
      }
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json"
      }
    }
  );
}


const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Bot funcionando en el puerto ${PORT}`);
});