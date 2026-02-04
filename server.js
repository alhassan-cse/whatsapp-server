const { default: makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const express = require("express");
const qrcode = require("qrcode");

const axios = require("axios");

const app = express();
app.use(express.json());

let sock;
let latestQR = "";

async function startSock() {
    const { state, saveCreds } = await useMultiFileAuthState("auth");

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
    });

    sock.ev.on("creds.update", saveCreds);

    const APP_URL = process.env.APP_URL || "http://localhost:8000";
    const ENDPOINT = "/api/whatsapp-connected";

    sock.ev.on("connection.update", async (update) => {
        const { qr, connection, lastDisconnect } = update;

        if (qr) {
            latestQR = await qrcode.toDataURL(qr);
            console.log("QR Ready");
        }

        if (connection === "open") {
            console.log("WhatsApp Connected ✅");
            console.log("Session info:", sock.user); // <-- এখানে mobile session data

            // Laravel API call
            fetch(APP_URL+ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user: sock.user })
            });
            
        }

        if (connection === "close") {
            console.log("Connection closed, attempting reconnect...");
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
            if (shouldReconnect) startSock();
        }
    });
}

// Start WhatsApp socket
startSock();

// Serve QR
// app.get("/qr", (req, res) => {
    
//     if (latestQR) {
//         console.log("WhatsApp ✅");
//         res.send(`<img src="${latestQR}" width="300" />`);
//     } else {
//         res.send("QR not ready yet, please wait...");
//     }
    
// });

app.get("/qr", async (req, res) => {
    if (!latestQR) return res.status(404).send("QR not ready yet");

    // latestQR = "data:image/png;base64,...."
    const base64Data = latestQR.replace(/^data:image\/png;base64,/, "");
    const imgBuffer = Buffer.from(base64Data, "base64");

    res.writeHead(200, {
        "Content-Type": "image/png",
        "Content-Length": imgBuffer.length,
    });
    res.end(imgBuffer);
});



// Send message endpoint
// app.post("/send-message", async (req, res) => {
//     const { number, message } = req.body;

//     if (!sock) return res.status(500).json({ status: "error", msg: "WhatsApp not connected yet" });

//     try {
//         await sock.sendMessage(number + "@s.whatsapp.net", { text: message });
//         res.json({ status: "sent" });
//     } catch (err) {
//         console.log(err);
//         res.status(500).json({ status: "error", msg: err.message });
//     }
// });
let isConnected = false;

app.post("/send-message", async (req, res) => {

    console.log("🔥 API HIT");

    // if (!sock || !isConnected) {
    //     console.log("🔥 API HIT 222");
    //     return res.status(503).json({
    //         error: "WhatsApp not connected yet"
    //     });
    // }

    try {
        const { number, file_url, caption, name } = req.body;

        if (!sock) {
            return res.status(500).json({ error: "WhatsApp not connected" });
        }

        // 1️⃣ Download PDF from Laravel
        const response = await axios.get(file_url, {
            responseType: "arraybuffer",
        });

        const pdfBuffer = Buffer.from(response.data);

        // 2️⃣ Send PDF as document
        await sock.sendMessage(number + "@s.whatsapp.net", {
            document: pdfBuffer,
            mimetype: "application/pdf",
            fileName: "invoice.pdf",
            caption: caption || "🧾 Your invoice From " + name,
        });

        return res.json({ ok: true });

        // res.json({ status: "sent" });
    } catch (err) {
        console.error("Send PDF error:", err);
        res.status(500).json({ error: err.message });
    }
});

 


app.listen(3000, () => console.log("WA server running on 3000"));
