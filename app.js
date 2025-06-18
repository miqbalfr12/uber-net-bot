const {Client, LocalAuth} = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const {body, validationResult} = require("express-validator");
const http = require("http");
const app = express();
const server = http.createServer(app);

const client = new Client({
 restartOnAuthFail: true,
 puppeteer: {
  headless: true,
  args: [
   "--no-sandbox",
   "--disable-setuid-sandbox",
   "--disable-dev-shm-usage",
   "--disable-accelerated-2d-canvas",
   "--no-first-run",
   "--no-zygote",
   "--disable-gpu",
  ],
 },
 authStrategy: new LocalAuth(),
});

client.on("ready", () => {
 console.log("Client is ready!");
});

client.on("qr", (qr) => {
 qrcode.generate(qr, {small: true});
});

client.initialize();

app.use(express.urlencoded({extended: true}));

app.use(express.json());

app.use(bodyParser.json());

const checkReqNum = async function (number) {
 console.log(number);
 if (number.includes("@c.us")) {
  const isReg = client.isRegisteredUser(number);
  return isReg;
 } else {
  try {
   const dataChat = await client.getChatById(number);
   if (number.includes("@g.us") && dataChat.isGroup) return true;
  } catch (error) {
   return false;
  }
 }
};

const pnf = function (number) {
 let formatted = number.replace(/\D/g, ""); //Merubah segala sesuatu selain angka
 if (formatted.startsWith("0")) {
  formatted = "62" + formatted.substr(1);
 } //mengganti 0 jadi 62 jika ada
 if (!formatted.endsWith("@c.us")) {
  formatted += "@c.us";
 } //menambah akhiran @c.us
 return formatted; //Mengembalikan nomor yang telah di Format
};

app.post(
 "/send-message",
 [body("number").notEmpty(), body("message").notEmpty()],
 async (req, res) => {
  const errors = validationResult(req).formatWith(({msg}) => {
   return msg;
  });

  if (!errors.isEmpty()) {
   return res.status(422).json({
    status: false,
    message: errors.mapped(),
   });
  }
  const number = pnf(req.body.number);
  const message = req.body.message;

  const isRegNum = await checkReqNum(number);

  if (!isRegNum) {
   return res.status(422).json({
    status: false,
    message: "The number is not registered",
   });
  }

  client
   .sendMessage(number, message)
   .then((response) => {
    res.status(200).json({
     status: true,
     response: response,
    });
   })
   .catch((err) => {
    res.status(500).json({
     status: false,
     response: err,
    });
   });
 }
);

app.post(
 "/send-group",
 [body("number").notEmpty(), body("message").notEmpty()],
 async (req, res) => {
  const errors = validationResult(req).formatWith(({msg}) => {
   return msg;
  });

  if (!errors.isEmpty()) {
   return res.status(422).json({
    status: false,
    message: errors.mapped(),
   });
  }
  const number = req.body.number;
  const message = req.body.message;

  client
   .sendMessage(number, message)
   .then((response) => {
    res.status(200).json({
     status: true,
     response: response,
    });
   })
   .catch((err) => {
    res.status(500).json({
     status: false,
     response: err,
    });
   });
 }
);

server.listen(3002, function () {
 console.log("Whatsapp bot running on : " + 3002);
});

client.on("message", async (message) => {
 if (message.from === "status@broadcast") return;

 const msg = message.body;
 const args = msg.split(" ");
 const cmd = args.shift().toLowerCase();

 if (message.body === "!ping") {
  message.reply("pong");
 }
 if (args[0].toLowerCase() == "register" && args[1]) {
  try {
   await fetch(`${process.env.BASE_URL_BACKEND}/api/v1.0.0/user`, {
    method: "PUT",
    headers: {
     "Content-Type": "application/json",
     authorization: `Bearer ${process.env.API_KEY}`,
    },
    cache: "no-store",
    body: JSON.stringify({user_id: args[1], wag: message.from}),
   })
    .then((res) => {
     if (res.ok) return res.json();
     else console.log(res);
    })
    .then((data) => {
     console.log(data);
     message.reply(`${args[1]} Registered Successfully!`);
    });
  } catch (error) {
   message.reply(error.message);
   console.log(error);
  }
 }
});
