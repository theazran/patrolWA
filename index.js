const querystring = require('node:querystring')
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    downloadContentFromMessage,
    delay,
    isJidGroup
} = require("@whiskeysockets/baileys");
require('dotenv').config()
const fs = require("fs");
const logger = require("pino")({ level: "silent" });
const { Boom } = require("@hapi/boom");
const idApp = `https://script.google.com/macros/s/${process.env.ID_SPREADSHEET}/exec?`
async function run() {
    const { state, saveCreds } = await useMultiFileAuthState("sessions");
    const client = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger,
    });

    //   connection
    client.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            if (
                new Boom(lastDisconnect.error).output?.statusCode ===
                DisconnectReason.loggedOut
            ) {
                client.logout();
                console.log("Logged out...");
            } else {
                run();
            }
        } else {
            console.log("BOT Running...");
        }
    });
    //   save creds
    client.ev.on("creds.update", saveCreds);
    client.ev.on("messages.upsert", async (msg) => {
        try {
            if (!msg.messages) return;
            const m = msg.messages[0];
            if (m.key.fromMe) return;
            var from = m.key.remoteJid;
            let type = Object.keys(m.message)[0];
            const body =
                type === "conversation"
                    ? m.message.conversation
                    : type == "imageMessage"
                        ? m.message.imageMessage.caption
                        : type == "videoMessage"
                            ? m.message.videoMessage.caption
                            : type == "extendedTextMessage"
                                ? m.message.extendedTextMessage.text
                                : type == "buttonsResponseMessage"
                                    ? m.message.buttonsResponseMessage.selectedButtonId
                                    : type == "listResponseMessage"
                                        ? m.message.listResponseMessage.singleSelectReply.selectedRowId
                                        : type == "templateButtonReplyMessage"
                                            ? m.message.templateButtonReplyMessage.selectedId
                                            : type === "messageContextInfo"
                                                ? m.message.listResponseMessage.singleSelectReply.selectedRowId ||
                                                m.message.buttonsResponseMessage.selectedButtonId ||
                                                m.text
                                                : "";
            const isMedia = (type === 'imageMessage' || type === 'videoMessage')
            const isQuotedImage = type === 'extendedTextMessage' && content.includes('imageMessage')
            global.reply = async (text) => {
                await client.sendPresenceUpdate("composing", from);
                return client.sendMessage(from, { text }, { quoted: m });
            };

            client.downloadMediaMessage = downloadMediaMessage
            async function downloadMediaMessage(message) {
                let mimes = (message.msg || message).mimetype || ''
                let messageType = mimes.split('/')[0].replace('application', 'document') ? mimes.split('/')[0].replace('application', 'document') : mimes.split('/')[0]
                let extension = mimes.split('/')[1]
                const stream = await downloadContentFromMessage(message, messageType)
                let buffer = Buffer.from([])
                for await (const chunk of stream) {
                    buffer = Buffer.concat([buffer, chunk])
                }
                return buffer
            }

            global.prefix = /^[./~!#%^&+=\-,;:()]/.test(body) ? body.match(/^[./~!#%^&+=\-,;:()]/gi) : '#'

            const arg = body.substring(body.indexOf(' ') + 1)
            const args = body.trim().split(/ +/).slice(1);
            let flags = [];
            const isCmd = body.startsWith(global.prefix);
            const cmd = isCmd ? body.slice(1).trim().split(/ +/).shift().toLocaleLowerCase() : null
            let url = args.length !== 0 ? args[0] : ''
            let pushname = m.pushName

            const isGroupMsg = isJidGroup(from)
            const groupId = isGroupMsg ? from : ''
            if (isGroupMsg) return
            async function fetchSheetDataByMonth(month) {
                try {
                    const response = await fetch(idApp);
                    const data = await response.json();

                    const filteredData = data.filter(entry => {
                        const entryMonth = new Date(entry.timestamp).getMonth() + 1;
                        return entryMonth === month;
                    });

                    const formattedData = filteredData.map(entry => ({
                        ...entry,
                        timestamp: new Date(entry.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
                    }));
                    console.log('Success');
                    await reply(`Laporan untuk bulan ${month}: ${JSON.stringify(formattedData, null, 2)}`);
                } catch (error) {
                    console.error(`Error fetching data: ${error.message}`);
                }
            }

            try {
                if (type === "imageMessage") {
                    const message = isQuotedImage ? m.quoted : m.message.imageMessage
                    const buff = await client.downloadMediaMessage(message)
                    console.log(message)

                } else if (cmd === "masuk" || cmd === "keluar") {
                    if (args < 1) return reply('contoh: /' + cmd + ' Asran, Pasang Spanduk');

                    const ran = arg.split('#');
                    if (cmd === "masuk") {
                        if (ran.length !== 2) {
                            return reply(`Format salah! Format yang benar adalah \n\n/masuk Nama#Keperluan`);
                        }
                    } else if (cmd === "keluar") {
                        if (ran.length !== 2) {
                            return reply(`Format salah! Format yang benar adalah \n\n/keluar Nama#Keperluan`);
                        }
                    }
                    const allowedUsers = [
                        { Nama: 'M. Asran', WA: '6285255646434' },
                        { Nama: 'Aas', WA: '6285255646333' }
                    ];
                    const senderWA = from.split('@')[0];

                    const allowedUser = allowedUsers.find(user => user.WA === senderWA);

                    if (allowedUser) {
                        const data = {
                            Petugas: allowedUser.Nama,
                            Nama: ran[0],
                            Keperluan: ran[1],
                            'Keluar_Masuk': cmd === "masuk" ? "Masuk" : "Keluar",
                            WA: senderWA
                        };

                        console.log(data);

                        const res = await fetch(idApp + querystring.stringify(data), { method: "POST" });
                        const respon = await res.json();

                        if (respon.result === "success") {
                            await client.sendMessage("120363230010661540@g.us", {
                                text: `⚠️ _*LAPORAN BARU*_\n\n*${cmd.toUpperCase()} KANTOR*\nNama: ${ran[0]}\nKeperluan: ${ran[1]}\n\n\nTertanda,\n${allowedUser.Nama}`
                            })
                            await reply(`Data Berhasil disimpan!\n\n*${cmd.toUpperCase()} KANTOR*\nNama: ${ran[0]}\nKeperluan: ${ran[1]}\nPetugas: ${allowedUser.Nama}`);
                        }
                    } else {
                        await reply('Fitur ini hanya dapat digunakan oleh security');
                    }
                } else if (cmd === "laporan") {
                    await reply('Dalam proses pengembangan!')
                } else {
                    const availableCommands = 'Perintah yang dapat digunakan:\n/masuk = Masuk Kantor\n/keluar = Keluar Kantor\n/laporan = Laporan Bulanan';
                    await reply(`Perintah tidak dikenali. ${availableCommands}`);
                }
            } catch (error) {
                console.log(error);
            }
        } catch (error) {
            console.log(error);
        }
    });
}

// running bot
try {
    run();
} catch (e) {
    console.log(e);
}
