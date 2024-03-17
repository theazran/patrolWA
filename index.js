const querystring = require('node:querystring')
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    downloadContentFromMessage,
    downloadMediaMessage,
    delay,
    isJidGroup
} = require("@whiskeysockets/baileys");
require('dotenv').config()
const fs = require("fs");
const axios = require('axios');
const pdf = require('html-pdf');
var TinyURL = require('shefin-tinyurl');
let package = require('./package.json');
const moment = require('moment');
const { uploadByBuffer } = require('telegraph-uploader');
const logger = require("pino")({ level: "silent" });
const CFonts = require('cfonts');
const chalk = require('chalk');
const gradient = require('gradient-string');
const { Boom } = require("@hapi/boom");
const idApp = `https://script.google.com/macros/s/${process.env.ID_SPREADSHEET}/exec?`
console.log(process.env.ID_SPREADSHEET)
async function run() {
    CFonts.say(`${package.name}`, {
        font: 'shade',
        align: 'center',
        gradient: ['#12c2e9', '#c471ed'],
        transitionGradient: true,
        letterSpacing: 3,
    });
    CFonts.say(`'${package.name}' Coded By ${package.author}`, {
        font: 'console',
        align: 'center',
        gradient: ['#DCE35B', '#45B649'],
        transitionGradient: true,
    });
    const { state, saveCreds } = await useMultiFileAuthState("sessions");
    const client = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger,
    });

    const color = (text, color) => {
        return !color ? chalk.green(text) : color.startsWith('#') ? chalk.hex(color)(text) : chalk.keyword(color)(text);
    };

    function bgColor(text, color) {
        return !color
            ? chalk.bgGreen(text)
            : color.startsWith('#')
                ? chalk.bgHex(color)(text)
                : chalk.bgKeyword(color)(text);
    }

    //   connection
    client.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "connecting") {
            console.log(
                color('[SYS]', '#009FFF'),
                color(moment().format('DD/MM/YY HH:mm:ss'), '#A1FFCE'),
                color(`${package.name} is Authenticating...`, '#f64f59')
            );
        } else if (connection === "close") {
            console.log('connection closed, try to restart');
            if (
                new Boom(lastDisconnect.error).output?.statusCode ===
                DisconnectReason.loggedOut
            ) {
                client.logout();
                console.log("Logged out...");
            } else {
                run();
            }
        } else if (connection === "open") {
            console.log(
                color('[SYS]', '#009FFF'),
                color(moment().format('DD/MM/YY HH:mm:ss'), '#A1FFCE'),
                color(`${package.name} is now Connected...`, '#38ef7d')
            );
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
            let t = m.messageTimestamp
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
            const content = JSON.stringify(JSON.parse(JSON.stringify(msg)).messages[0].message)
            const isQuotedImage = type === 'extendedTextMessage' && content.includes('imageMessage')
            global.reply = async (text) => {
                await client.sendPresenceUpdate("composing", from);
                return client.sendMessage(from, { text }, { quoted: m });
            };

            const logEvent = (text) => {
                if (!isGroupMsg) {
                    console.log(bgColor(color('[EXEC]', 'black'), '#38ef7d'), color(moment(t * 1000).format('DD/MM/YY HH:mm:ss'), '#A1FFCE'), gradient.summer(`[${text}]`), bgColor(color(type, 'black'), 'cyan'), '~> from', gradient.cristal(pushname))
                }
                if (isGroupMsg) {
                    console.log(bgColor(color('[EXEC]', 'black'), '#38ef7d'), color(moment(t * 1000).format('DD/MM/YY HH:mm:ss'), '#A1FFCE'), gradient.summer(`[${text}]`), bgColor(color(type, 'black'), 'cyan'), '~> from', gradient.cristal(pushname), 'in', gradient.fruit(formattedTitle))
                }
            }


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
            console.log(groupId)
            if (isGroupMsg) return

            // pdf
            async function fetchData() {
                try {
                    const response = await axios.get('https://opensheet.elk.sh/1kwsvHO00ZOZj3kJ-MkFeJSNzy0k0EfKHpU8X8RlOv8M/Sheet1');
                    return response.data;
                } catch (error) {
                    console.error('Error fetching data:', error.message);
                    throw error;
                }
            }

            async function filterDataByMonth(data, targetMonth) {
                const filteredData = data.filter(entry => {
                    const entryMonth = entry.timestamp.split('/')[1];
                    return entryMonth === targetMonth;
                });

                return filteredData;
            }

            async function generatePDF(data, targetMonth) {
                const monthNames = [
                    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
                ];

                global.monthTitle = monthNames[parseInt(targetMonth, 10) - 1];

                const tableRows = data.map(entry => `
                    <tr>
                    <td>${entry.timestamp}</td>
                    <td>${entry.Keluar_Masuk}</td>
                    <td>${entry.Nama}</td>
                    <td>${entry.Keperluan}</td>
                    <td>${entry.Petugas}</td>
                    <td>${entry.WA}</td>
                    <td>${entry.Foto}</td>
                    </tr>
                `);

                const htmlTemplate = `
                    <html>
                    <head>
                        <title>LAPORAN SATPAN</title>
                        <style>
                        table {
                            border-collapse: collapse;
                            width: 100%;
                        }
                        th, td {
                            border: 1px solid black;
                            padding: 8px;
                            text-align: left;
                        }
                        </style>
                    </head>
                    <body>
                        <h1>Laporan Bulan ${monthTitle}</h1>
                        <table>
                        <thead>
                            <tr>
                            <th>Tanggal dan Waktu</th>
                            <th>Keluar/Masuk</th>
                            <th>Nama</th>
                            <th>Keperluan</th>
                            <th>Petugas</th>
                            <th>WA</th>
                            <th>Link Foto</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows.join('')}
                        </tbody>
                        </table>
                    </body>
                    </html>
                `;

                const pdfOptions = { format: 'Letter' };
                pdf.create(htmlTemplate, pdfOptions).toFile(`laporan_bulan_${monthTitle}.pdf`, (err, res) => {
                    if (err) return console.error(err);
                    console.log('PDF file generated successfully.');
                });
            }
            // end  of pdf
            if (type === "imageMessage") {
                const message = isQuotedImage ? m.quoted : m.message.imageMessage;
                const buff = await client.downloadMediaMessage(message, "buffer", {}, { logger });
                const ress = await uploadByBuffer(buff, 'image/jpeg');
                if (cmd === "masuk" || cmd === "keluar") {
                    logEvent(cmd)
                    if (args < 1) return reply(`Contoh: /${cmd} Asran#Pasang Spanduk`);
                    const ran = arg.split('#');
                    const namaAlias = moment().format('DDMMYYYY-HHmmss');
                    const data = { 'url': ress.link, 'alias': `${ran[0]}-${namaAlias}` }
                    const shorten = await TinyURL.shortenWithAlias(data)
                    if (ran.length !== 2) return reply(`Format salah! Format yang benar adalah \n\n/${cmd} Nama#Keperluan`);
                    const allowedUsers = [
                        { Nama: 'Security', WA: '6285255646434' },
                        { Nama: 'Renaldi', WA: '6281241559321' },
                        { Nama: 'Security', WA: '6285255646333' }
                    ];
                    const senderWA = from.split('@')[0];
                    const allowedUser = allowedUsers.find(user => user.WA === senderWA);
                    if (allowedUser) {
                        const data = {
                            Petugas: allowedUser.Nama,
                            Nama: ran[0],
                            Keperluan: ran[1],
                            'Keluar_Masuk': cmd === "masuk" ? "Masuk" : "Keluar",
                            WA: senderWA,
                            Foto: cmd === "masuk" ? shorten : "-"
                        };
                        const res = await fetch(idApp + querystring.stringify(data), { method: "POST" });
                        const respon = await res.json();
                        if (respon.result === "success") {
                            await client.sendMessage("120363256542098102@g.us", {
                                text: `⚠️ _*LAPORAN BARU*_\n\n*${cmd.toUpperCase()} KANTOR*\nNama: ${ran[0]}\nKeperluan: ${ran[1]}\nLink Foto: ${shorten}\n\n\nTertanda,\n${allowedUser.Nama}`
                            });
                            await reply(`Data Berhasil disimpan!\n\n*${cmd.toUpperCase()} KANTOR*\nNama: ${ran[0]}\nKeperluan: ${ran[1]}\nLink Foto: ${shorten}\nPetugas: ${allowedUser.Nama}`);
                        }
                    } else {
                        await reply('Fitur ini hanya dapat digunakan oleh security');
                    }
                } else {
                    await reply('Ada kesalahan dalam penanganan gambar');
                }
            } else if (cmd === "masuk" || cmd === "keluar") {
                logEvent(cmd)
                if (args < 1) return reply(`Contoh: /${cmd} Asran#Pasang Spanduk`);
                const ran = arg.split('#');
                if (ran.length !== 2) return reply(`Format salah! Format yang benar adalah \n\n/${cmd} Nama#Keperluan`);
                const allowedUsers = [
                    { Nama: 'Security', WA: '6285255646434' },
                    { Nama: 'Renaldi', WA: '6281241559321' },
                    { Nama: 'Security', WA: '6285255646333' }
                ];
                const senderWA = from.split('@')[0];
                const allowedUser = allowedUsers.find(user => user.WA === senderWA);
                if (allowedUser) {
                    const data = {
                        Petugas: allowedUser.Nama,
                        Nama: ran[0],
                        Keperluan: ran[1],
                        'Keluar_Masuk': cmd === "masuk" ? "Masuk" : "Keluar",
                        WA: senderWA,
                        Foto: "-"
                    };
                    const res = await fetch(idApp + querystring.stringify(data), { method: "POST" });
                    const respon = await res.json();
                    if (respon.result === "success") {
                        await client.sendMessage("120363256542098102@g.us", {
                            text: `⚠️ _*LAPORAN BARU*_\n\n*${cmd.toUpperCase()} KANTOR*\nNama: ${ran[0]}\nKeperluan: ${ran[1]}\n\n\nTertanda,\n${allowedUser.Nama}`
                        });
                        await reply(`Data Berhasil disimpan!\n\n*${cmd.toUpperCase()} KANTOR*\nNama: ${ran[0]}\nKeperluan: ${ran[1]}\nPetugas: ${allowedUser.Nama}`);
                    }
                } else {
                    await reply('Fitur ini hanya dapat digunakan oleh security');
                }
            } else if (cmd === "laporan") {
                logEvent(cmd)
                if (args.length < 1) return reply(`Untuk melihat laporan, ketik ${prefix}laporan 03`);
                const targetMonth = arg;
                await reply('Mohon tunggu sebentar!');
                try {
                    const rawData = await fetchData();
                    const filteredData = await filterDataByMonth(rawData, targetMonth);
                    const pdfPath = await generatePDF(filteredData, targetMonth);
                    const pdfFileName = `laporan_bulan_${monthTitle}.pdf`;
                    setTimeout(async () => {
                        console.log('PDF file sent to WhatsApp successfully.');
                        await sendFile(from, pdfFileName, pdfFileName, 'application/pdf');
                    }, 5000);
                } catch (error) {
                    console.error('An error occurred:', error.message);
                    await reply('Terjadi kesalahan saat memproses laporan. Harap coba lagi!');
                }
            } else {
                const availableCommands = 'Perintah yang dapat digunakan:\n/masuk = Masuk Kantor\n/keluar = Keluar Kantor\n/laporan = Laporan Bulanan';
                await reply(`Perintah tidak dikenali. ${availableCommands}`);
            }
        } catch (error) {
            console.log(error);
        }
    });
    async function sendFile(jid, path, fileName, mimetype = '', quoted = '', options = {}) {
        return await client.sendMessage(jid, { document: { url: path }, mimetype, fileName, ...options }, { quoted })
            .then(() => {
                try {
                    fs.unlinkSync(path)
                } catch (error) {
                    console.log(error);
                }
            })
    }

}

// running bot
try {
    run();
} catch (e) {
    console.log(e);
}
