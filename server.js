const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();

app.use(express.json());

// Guardar mensajes recibidos mientras el servidor funciona
const mensajes = [];

// Recordar quién ya recibió bienvenida
const usuariosIniciados = new Set();


// VERIFICACIÓN WEBHOOK
app.get("/webhook", (req, res) => {
  if (req.query["hub.verify_token"] === process.env.VERIFY_TOKEN) {
    return res.send(req.query["hub.challenge"]);
  }

  res.sendStatus(403);
});


// MENSAJES RECIBIDOS
app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  const message =
    req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

  if (!message) return;

  const from = message.from;


  // MENSAJE DE TEXTO
  if (message.type === "text") {

    mensajes.push({
      from,
      texto: message.text.body,
      fecha: new Date().toISOString()
    });

    console.log(`Mensaje de ${from}: ${message.text.body}`);


    // SOLO PRIMER MENSAJE
    if (!usuariosIniciados.has(from)) {
      usuariosIniciados.add(from);
      await menu(from);
    } else {

      await texto(
        from,
        "👍 Perfecto. Decime qué necesitás y te ayudo.\n\nTambién podés elegir una opción del menú si querés."
      );

    }
  }


  // BOTONES
  if (message.type === "interactive") {

    const id = message.interactive.button_reply?.id;


    if (id === "catalogo") {

      await texto(
        from,
        "🛒 Acá podés ver todos nuestros productos:\n\nhttps://golosinasaries.github.io/catalogo\n\n🇦🇷 Enviamos a todo el país."
      );

    }


    if (id === "origen") {

      await texto(
        from,
        "📍 Somos de Miramar, Buenos Aires.\n\n🇦🇷 Hacemos envíos a todo el país por Correo Argentino y el pedido suele llegar en 2 a 5 días hábiles.\n\n🏪 ¿Tenés kiosco o comercio?"
      );

    }


    if (id === "comercio") {

      await texto(
        from,
        "¡Buenísimo! 🙌✨\n\nTe invitamos a sumarte a nuestro grupo de WhatsApp:\n\nhttps://chat.whatsapp.com/Gvuz6sIsH1a4IssI5lAMad"
      );

    }

  }

});


// VER MENSAJES
app.get("/mensajes", (req, res) => {
  res.json(mensajes);
});


// MENÚ INICIAL
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



// TEXTO SIMPLE
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