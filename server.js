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
      textoCliente.includes("quiero comprar")||
      textoCliente.includes("hacer pedido")||
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
  textoCliente.includes("envio")||
  textoCliente.includes("envíos")||
  textoCliente.includes("envios")||
  textoCliente.includes("correo")
){
  await envios(from);
  return;
}


if(
  textoCliente.includes("donde")||
  textoCliente.includes("dónde")||
  textoCliente.includes("ubicacion")||
  textoCliente.includes("ubicación")||
  textoCliente.includes("miramar")
){
  await ubicacion(from);
  return;
}


  if(
    textoCliente.includes("demora")||
    textoCliente.includes("cuanto tarda")||
    textoCliente.includes("cuánto tarda")||
    textoCliente.includes("tiempo")
  ){
    await demora(from);
    return;
  }

    if(
      textoCliente.includes("asesor")||
      textoCliente.includes("persona")||
      textoCliente.includes("humano")||
      textoCliente.includes("vendedor")||
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
    `😅 No llegué a entender tu consulta.

    Puedo ayudarte con:
    🛒 Productos
    📦 Cómo comprar
    💳 Pagos
    🚚 Envíos
    📍 Ubicación

    Escribime qué necesitás 😊`
    );
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

console.log("ADMIN CARGADO");

app.get("/admin",protegerAdmin,(req,res)=>{

const clientes=[...new Set(mensajes.map(m=>m.from))];

let cliente=req.query.cliente || clientes[0] || "";

let conversacion=mensajes.filter(m=>m.from===cliente);

let html=`
<html>
<head>
<title>Golosinas Aries</title>

<style>
body{
font-family:Arial;
margin:0;
display:flex;
height:100vh;
background:#eee;
}

#clientes{
width:300px;
background:white;
border-right:1px solid #ccc;
padding:15px;
overflow:auto;
}

.cliente{
padding:12px;
border-bottom:1px solid #ddd;
}

.cliente a{
text-decoration:none;
color:black;
}

#chat{
flex:1;
display:flex;
flex-direction:column;
padding:20px;
}

.mensajes{
flex:1;
overflow:auto;
}

.burbuja{
padding:10px;
margin:10px;
border-radius:10px;
max-width:60%;
}

.entrada{
background:white;
}

.salida{
background:#c8f7c5;
margin-left:auto;
}

textarea{
height:60px;
}

button{
padding:12px;
}

</style>

</head>

<body>

<div id="clientes">

<h2>Clientes</h2>

`;

clientes.forEach(c=>{

html+=`

<div class="cliente">
<a href="/admin?cliente=${c}">
${c}
</a>
</div>

`;

});


html+=`

</div>


<div id="chat">

<h2>${cliente}</h2>


<div class="mensajes">

`;

conversacion.forEach(m=>{

html+=`

<div class="burbuja ${m.direccion}">
${m.texto}
<br>
<small>${m.fecha}</small>
</div>

`;

});


html+=`

</div>


<textarea id="mensaje" placeholder="Escribir mensaje..."></textarea>

<button onclick="enviar()">Enviar</button>


<script>

async function enviar(){

let mensaje=document.getElementById("mensaje").value;

await fetch("/responder",{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({
to:"${cliente}",
mensaje
})

});


location.reload();

}

</script>


</div>

</body>
</html>
`;

res.send(html);

});

async function menu(to){
  await enviarBoton(
    to,
    "👋 ¡Hola! Bienvenid@ a Golosinas Aries ♈🔥\n\nPuedo ayudarte con información sobre productos, compras, pagos y envíos.\n\n¿Qué querés consultar?",
    [
      {id:"catalogo",title:"🛒 Ver catálogo"},
      {id:"comprar",title:"📦 ¿Cómo comprar?"}
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

async function pasarVentas(to){

  await texto(
    to,
`🛒 ¡Perfecto! Para finalizar tu compra te atendemos por nuestro WhatsApp de ventas:

📲 2236010443

Escribinos ahí y seguimos con tu pedido 😊`
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

async function envios(to){
  await texto(
    to,
`🚚 Realizamos envíos a todo el país.

Trabajamos con Correo Argentino y otros medios según la zona.

Decime de dónde sos y te ayudo 😊`
  );
}


async function ubicacion(to){
  await texto(
    to,
`📍 Estamos en Miramar, Buenos Aires.

Hacemos envíos a todo el país 🇦🇷`
  );
}


async function demora(to){
  await texto(
    to,
`⏱️ Los tiempos dependen de la localidad y del medio de envío.

Si me decís tu ciudad te puedo orientar 😊`
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
}).on("error",err=>{
  console.log(err);
});