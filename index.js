const querystring = require('node:querystring')
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    generateForwardMessageContent,
    delay,
} = require("@whiskeysockets/baileys");
const idApp = `https://script.google.com/macros/s/AKfycbzLAqrB3EDuOomueHyZFPaPQy2OfVnvbsyBABPCMYe9Hf4Loqsh-LYlaXOMApQEs8eI4Q/exec?`
const logger = require("pino")({ level: "silent" });
const { Boom } = require("@hapi/boom");
require('dotenv').config()
const fs = require("fs");

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
            global.reply = async (text) => {
                await client.sendPresenceUpdate("composing", from);
                return client.sendMessage(from, { text }, { quoted: m });
            };


            global.prefix = /^[./~!#%^&+=\-,;:()]/.test(body) ? body.match(/^[./~!#%^&+=\-,;:()]/gi) : '#'

            const arg = body.substring(body.indexOf(' ') + 1)
            const args = body.trim().split(/ +/).slice(1);
            let flags = [];
            const isCmd = body.startsWith(global.prefix);
            const cmd = isCmd ? body.slice(1).trim().split(/ +/).shift().toLocaleLowerCase() : null
            let url = args.length !== 0 ? args[0] : ''
            let pushname = m.pushName
            console.log(from)

            async function fetchSheetDataByMonth(month) {
                const url = 'https://opensheet.elk.sh/1kwsvHO00ZOZj3kJ-MkFeJSNzy0k0EfKHpU8X8RlOv8M/Sheet1';

                try {
                    const response = await fetch(url);
                    const data = await response.json();

                    const filteredData = data.filter(entry => {
                        const entryMonth = new Date(entry.timestamp).getMonth() + 1; // Months are zero-based, so add 1
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
                if (cmd === "masuk" || cmd === "keluar") {
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
                    await fetchSheetDataByMonth(arg);
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
