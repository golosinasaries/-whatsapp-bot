const express = require("express");
const axios = require("axios");
const fs = require("fs");
require("dotenv").config();

const app = express();

app.use(express.json());


// =======================
// GUARDADO DE CONVERSACIONES
// =======================

const ARCHIVO = "./conversaciones.json";


function cargarConversaciones() {

  if (!fs.existsSync(ARCHIVO)) {
    fs.writeFileSync(ARCHIVO, "[]");
  }

  return JSON.parse(fs.readFileSync(ARCHIVO));

}


function guardarConversaciones(datos) {

  fs.writeFileSync(
    ARCHIVO,
    JSON.stringify(datos, null, 2)
  );

}


let mensajes = cargarConversaciones();



// Recordar usuarios que ya recibieron bienvenida
const usuariosIniciados = new Set();


// Usuarios atendidos por humano
const usuariosAsesor = new Set();




// =======================
// VERIFICACIÓN WEBHOOK
// =======================

app.get("/webhook", (req, res) => {

  if (req.query["hub.verify_token"] === process.env.VERIFY_TOKEN) {

    return res.send(req.query["hub.challenge"]);

  }

  res.sendStatus(403);

});




// =======================
// MENSAJES RECIBIDOS
// =======================

app.post("/webhook", async (req, res) => {


  res.sendStatus(200);


  const message =
    req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];


  if (!message) return;


  const from = message.from;



  // =======================
  // MENSAJE TEXTO
  // =======================

  if (message.type === "text") {


    const textoCliente = message.text.body.toLowerCase();



    mensajes.push({

      from,

      texto: message.text.body,

      fecha: new Date().toISOString(),

      estado: usuariosAsesor.has(from)
        ? "humano"
        : "bot"

    });


    guardarConversaciones(mensajes);



    console.log(
      `Mensaje de ${from}: ${message.text.body}`
    );




    // Si ya está con humano
    if (usuariosAsesor.has(from)) {

      return;

    }





    // Primera interacción

    if (!usuariosIniciados.has(from)) {

      usuariosIniciados.add(from);

      await menu(from);

      return;

    }





    // COMPRAR

    if (

      textoCliente.includes("comprar") ||

      textoCliente.includes("pedido") ||

      textoCliente.includes("como compro") ||

      textoCliente.includes("cómo compro")

    ) {


      await comoComprar(from);

      return;

    }






    // PAGO

    if (

      textoCliente.includes("pago") ||

      textoCliente.includes("transferencia") ||

      textoCliente.includes("alias")

    ) {


      await pago(from);

      return;

    }






    // ASESOR

    if (

      textoCliente.includes("asesor") ||

      textoCliente.includes("persona") ||

      textoCliente.includes("ayuda")

    ) {


      await asesor(from);

      return;

    }






    // PRECIO

    if (

      textoCliente.includes("precio") ||

      textoCliente.includes("cuanto") ||

      textoCliente.includes("cuánto")

    ) {


      await texto(

        from,

        "🛒 Podés ver nuestros productos y precios actualizados acá:\n\nhttps://golosinasaries.github.io/catalogo\n\nSi necesitás ayuda con algún producto, contame 😊"

      );


      return;

    }






    // FALLBACK

    await texto(

      from,

      "😅 Perdón, no llegué a entenderte.\n\nContame qué necesitás y te ayudo 😊"

    );


    await menu(from);



  }







  // =======================
  // BOTONES
  // =======================


  if (message.type === "interactive") {


    const id =
      message.interactive.button_reply?.id;



    if (id === "catalogo") {


      await texto(

        from,

        "🛒 Acá podés ver todos nuestros productos:\n\nhttps://golosinasaries.github.io/catalogo\n\n📍 ¿De dónde sos?"

      );


    }




    if (id === "comprar") {


      await comoComprar(from);


    }




    if (id === "asesor") {


      await asesor(from);


    }



  }


});




// =======================
// VER CONVERSACIONES
// =======================

app.get("/mensajes", (req,res)=>{

  res.json(mensajes);

});





// =======================
// FUNCIONES
// =======================


async function menu(to) {


  await enviarBoton(

    to,

    "👋 ¡Hola! Bienvenid@ a Golosinas Aries ♈🔥\n\n🇦🇷 Enviamos a todo el país\n📍 Desde Miramar, Buenos Aires\n\n¿Qué querés hacer?",

    [

      {
        id:"catalogo",
        title:"🛒 Ver catálogo"
      },

      {
        id:"comprar",
        title:"📦 ¿Cómo comprar?"
      },

      {
        id:"asesor",
        title:"💬 Hablar con asesor"
      }

    ]

  );

}





async function comoComprar(to){


await texto(

to,

`¡Genial! 😊 Te cuento cómo realizar tu pedido:

1️⃣ Entrá al catálogo 👇

https://golosinasaries.github.io/catalogo

2️⃣ Agregá al carrito los productos que quieras 🛒

3️⃣ Tocá "Hacer pedido" y automáticamente te lleva a nuestro WhatsApp 📲

4️⃣ Te pedimos los datos necesarios para preparar el envío 📦

5️⃣ Realizás el pago por transferencia 💳

6️⃣ Te enviamos el número de seguimiento de Correo Argentino 🚚

¡Y listo! 🙌`

);


}





async function pago(to){


await texto(

to,

`💳 El pago se realiza por transferencia antes del envío.

Podés ver algunas referencias acá 👇

👉 Facebook:
https://www.facebook.com/profile.php?id=61578949001641

👉 Instagram:
https://www.instagram.com/golosinasaries`

);


}





async function asesor(to){


usuariosAsesor.add(to);



mensajes.push({

from:to,

texto:"Solicitó hablar con asesor",

fecha:new Date().toISOString(),

estado:"humano"

});


guardarConversaciones(mensajes);



await texto(

to,

`Perfecto 😊 En breve un asesor se pondrá en contacto con vos.

Mientras tanto, dejanos tu consulta en pocas palabras así podemos ayudarte mejor 🙌`

);


}





async function enviarBoton(to,cuerpo,botones){


await axios.post(

`https://graph.facebook.com/v23.0/${process.env.PHONE_NUMBER_ID}/messages`,

{

messaging_product:"whatsapp",

to,

type:"interactive",

interactive:{

type:"button",

body:{
text:cuerpo
},

action:{

buttons:

botones.map(b=>({

type:"reply",

reply:{

id:b.id,

title:b.title

}

}))

}

}

},

{

headers:{

Authorization:`Bearer ${process.env.WHATSAPP_TOKEN}`,

"Content-Type":"application/json"

}

}

);


}





async function texto(to,mensaje){


await axios.post(

`https://graph.facebook.com/v23.0/${process.env.PHONE_NUMBER_ID}/messages`,

{

messaging_product:"whatsapp",

to,

type:"text",

text:{

body:mensaje

}

},

{

headers:{

Authorization:`Bearer ${process.env.WHATSAPP_TOKEN}`,

"Content-Type":"application/json"

}

}

);


}





const PORT = process.env.PORT || 3000;


app.listen(PORT,()=>{

console.log(`Bot funcionando en el puerto ${PORT}`);

});