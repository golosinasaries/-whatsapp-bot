const express=require("express");
const axios=require("axios");
const fs=require("fs");
require("dotenv").config();

const app=express();
app.use(express.json());

const ARCHIVO="./conversaciones.json";

function cargarConversaciones(){
  if(!fs.existsSync(ARCHIVO)){
    fs.writeFileSync(ARCHIVO,"[]");
  }
  return JSON.parse(fs.readFileSync(ARCHIVO));
}

function guardarConversaciones(datos){
  fs.writeFileSync(ARCHIVO,JSON.stringify(datos,null,2));
}

let mensajes=cargarConversaciones();

const usuariosIniciados=new Set();
const usuariosAsesor=new Set();

app.get("/webhook",(req,res)=>{
  if(req.query["hub.verify_token"]===process.env.VERIFY_TOKEN){
    return res.send(req.query["hub.challenge"]);
  }
  res.sendStatus(403);
});


app.post("/webhook",async(req,res)=>{
  res.sendStatus(200);

  const message=req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

  if(!message)return;

  const from=message.from;


  if(
  message.type==="text"||
  message.type==="image"||
  message.type==="audio"||
  message.type==="document"||
  message.type==="video"
){

    let contenido="";
    let tipo=message.type;

    if(message.type==="text"){
      contenido=message.text.body;
    }

    if(message.type==="image"){
      contenido="📷 Imagen recibida";
    }

    if(message.type==="audio"){
      contenido="🎤 Audio recibido";
    }

    if(message.type==="document"){
      contenido="📄 Documento recibido";
    }

    if(message.type==="video"){
      contenido="🎥 Video recibido";
    }


    mensajes.push({
      from,
      tipo,
      texto:contenido,
      fecha:new Date().toISOString(),
      estado:usuariosAsesor.has(from)?"humano":"bot",
      direccion:"entrada"
    });

    guardarConversaciones(mensajes);

    console.log(`Mensaje ${tipo} de ${from}: ${contenido}`);


    if(message.type!=="text"){
      return;
    }


    const textoCliente=message.text.body.toLowerCase();


    if(usuariosAsesor.has(from)){
      return;
    }


    if(!usuariosIniciados.has(from)){
      usuariosIniciados.add(from);
      await menu(from);
      return;
    }


    if(
      textoCliente.includes("comprar")||
      textoCliente.includes("pedido")||
      textoCliente.includes("como compro")||
      textoCliente.includes("cómo compro")
    ){
      await comoComprar(from);
      return;
    }


    if(
      textoCliente.includes("pago")||
      textoCliente.includes("transferencia")||
      textoCliente.includes("alias")
    ){
      await pago(from);
      return;
    }


    if(
      textoCliente.includes("asesor")||
      textoCliente.includes("persona")||
      textoCliente.includes("ayuda")
    ){
      await asesor(from);
      return;
    }


    if(
      textoCliente.includes("precio")||
      textoCliente.includes("cuanto")||
      textoCliente.includes("cuánto")
    ){
      await texto(
        from,
        "🛒 Podés ver nuestros productos y precios actualizados acá:\n\nhttps://golosinasaries.github.io/catalogo\n\nSi necesitás ayuda con algún producto, contame 😊"
      );
      return;
    }


    await texto(
      from,
      "😅 Perdón, no llegué a entenderte.\n\nContame qué necesitás y te ayudo 😊"
    );

    await menu(from);
  }


  if(message.type==="interactive"){

    const id=message.interactive.button_reply?.id;

    if(id==="catalogo"){
      await texto(
        from,
        "🛒 Acá podés ver todos nuestros productos:\n\nhttps://golosinasaries.github.io/catalogo\n\n📍 ¿De dónde sos?"
      );
    }

    if(id==="comprar"){
      await comoComprar(from);
    }

    if(id==="asesor"){
      await asesor(from);
    }
  }

});


app.get("/mensajes",(req,res)=>{
  res.json(mensajes);
});
function protegerAdmin(req,res,next){

  const auth=req.headers.authorization;

  if(!auth){
    res.setHeader("WWW-Authenticate","Basic");
    return res.status(401).send("Necesita autorización");
  }

  const datos=Buffer.from(
    auth.split(" ")[1],
    "base64"
  ).toString().split(":");


  const usuario=datos[0];
  const clave=datos[1];


  if(
    usuario===process.env.ADMIN_USER &&
    clave===process.env.ADMIN_PASSWORD
  ){
    return next();
  }


  res.status(403).send("Acceso denegado");

}

app.get("/admin",protegerAdmin,(req,res)=>{

  let html = `
  <html>
  <head>
    <title>Golosinas Aries - Atención</title>
    <style>
      body{
        font-family:Arial;
        padding:20px;
        background:#f5f5f5;
      }
      .mensaje{
        background:white;
        padding:15px;
        margin-bottom:10px;
        border-radius:10px;
      }
      .humano{
        border-left:5px solid green;
      }
      .bot{
        border-left:5px solid blue;
      }
    </style>
  </head>

  <body>

  <h1>💬 Golosinas Aries - Atención</h1>

  `;


  mensajes.slice().reverse().forEach(m=>{

    html += `
    <div class="mensaje ${m.estado}">
      <b>Cliente:</b> ${m.from}<br>
      <b>Tipo:</b> ${m.tipo || "texto"}<br>
      <b>Mensaje:</b> ${m.texto}<br>
      <b>Fecha:</b> ${m.fecha}<br>
      <b>Estado:</b> ${m.estado}
    </div>
    `;

  });

  html += `

<h2>Responder cliente</h2>

<input id="cliente" placeholder="Número WhatsApp">

<br><br>

<textarea id="mensaje" placeholder="Escribí el mensaje"></textarea>

<br><br>

<button onclick="enviar()">Enviar</button>


<script>

async function enviar(){

const to=document.getElementById("cliente").value;

const mensaje=document.getElementById("mensaje").value;


await fetch("/responder",{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({
to,
mensaje,
tipo:"text"
})

});


alert("Mensaje enviado");

}

</script>

`;

  html += `
  </body>
  </html>
  `;


  res.send(html);

});

async function menu(to){
  await enviarBoton(
    to,
    "👋 ¡Hola! Bienvenid@ a Golosinas Aries ♈🔥\n\n🇦🇷 Enviamos a todo el país\n📍 Desde Miramar, Buenos Aires\n\n¿Qué querés hacer?",
    [
      {id:"catalogo",title:"🛒 Ver catálogo"},
      {id:"comprar",title:"📦 ¿Cómo comprar?"},
      {id:"asesor",title:"💬 Hablar con asesor"}
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
    estado:"humano",
    direccion:"entrada"
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
          buttons:botones.map(b=>({
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

async function enviarMensajeCliente(to, tipo, contenido){

  let payload = {
    messaging_product:"whatsapp",
    to,
    type:tipo
  };


  if(tipo==="text"){
    payload.text={
      body:contenido
    };
  }


  if(tipo==="image"){
    payload.image={
      link:contenido
    };
  }


  if(tipo==="video"){
    payload.video={
      link:contenido
    };
  }


  if(tipo==="audio"){
    payload.audio={
      link:contenido
    };
  }


  if(tipo==="document"){
    payload.document={
      link:contenido
    };
  }


  await axios.post(
    `https://graph.facebook.com/v23.0/${process.env.PHONE_NUMBER_ID}/messages`,
    payload,
    {
      headers:{
        Authorization:`Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type":"application/json"
      }
    }
  );


  mensajes.push({
    from:to,
    tipo,
    texto:contenido,
    fecha:new Date().toISOString(),
    estado:"humano",
    direccion:"salida"
  });


  guardarConversaciones(mensajes);

}

app.post("/responder",async(req,res)=>{

  const {to,mensaje,tipo="text"}=req.body;


  if(!to || !mensaje){
    return res.status(400).json({
      error:"Faltan datos"
    });
  }


  try{

    await enviarMensajeCliente(
      to,
      tipo,
      mensaje
    );


    res.json({
      ok:true
    });


  }catch(error){

    console.log(error.response?.data || error);

    res.status(500).json({
      error:"No se pudo enviar"
    });

  }

});

const PORT=process.env.PORT||3000;

app.listen(PORT,()=>{
  console.log(`Bot funcionando en el puerto ${PORT}`);
});