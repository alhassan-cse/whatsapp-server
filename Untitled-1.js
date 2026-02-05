app.post("/send-message", async (req, res) => {

    console.log("🔥 API HIT");

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