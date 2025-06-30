const fs = require('fs');
const path = require('path');
const express = require('express');
const { MongoClient } = require('mongodb');
const pino = require('pino');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
} = require('@whiskeysockets/baileys');

// === CONFIG ===
const SESSION_ID = 'mekaai_43cdf18f';
const LOG_FILE = path.join(__dirname, 'logs.txt');
const OWNER_JID = '263711346419@s.whatsapp.net';
let repliedMap = new Map();

// === LOGGING ===
fs.writeFileSync(LOG_FILE, '');
function log(...args) {
  const text = args.map(a => typeof a === 'string' ? a : JSON.stringify(a, null, 2)).join(' ');
  fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${text}\n`);
  console.log(...args);
}

// === EXTRACT TEXT ===
function extractText(msg) {
  if (!msg) return null;
  if (typeof msg === 'string') return msg;
  if (msg.conversation) return msg.conversation;
  if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text;
  if (msg.imageMessage?.caption) return msg.imageMessage.caption;
  if (msg.videoMessage?.caption) return msg.videoMessage.caption;
  if (msg.buttonsResponseMessage?.selectedButtonId) return msg.buttonsResponseMessage.selectedButtonId;
  if (msg.listResponseMessage?.singleSelectReply?.selectedRowId) return msg.listResponseMessage.singleSelectReply.selectedRowId;
  return null;
}

// === RESTORE SESSION ===
async function restoreSessionFromID(id) {
  const uri = "mongodb+srv://damilaraolamilekan:damilaraolamilekan@cluster0.tglsxja.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
  const client = new MongoClient(uri);
  await client.connect();
  const database = client.db("mekaSessions");
  const sessions = database.collection("sessions");
  const doc = await sessions.findOne({ _id: id });

  if (!doc) {
    log("❌ Session not found in MongoDB for ID:", id);
    process.exit(1);
  }

  const data = Buffer.from(doc.sessionData, 'base64');
  const sessionDir = path.join(__dirname, 'session');
  if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir);
  fs.writeFileSync(path.join(sessionDir, 'creds.json'), data);
  log('✅ Session restored from MongoDB:', id);
  await client.close();
}

// === START BOT ===
async function startBot(id) {
  await restoreSessionFromID(id);
  const { state, saveCreds } = await useMultiFileAuthState('./session');

  const sock = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
    },
    browser: ['Ubuntu', 'Chrome', 'meka'],
    logger: pino({ level: 'silent' }),
    syncFullHistory: false,
    shouldIgnoreJid: () => false,
    getMessage: async () => undefined,
    emitOwnEvents: true,
    markOnlineOnConnect: true,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection }) => {
    log('🔌 Connection update:', connection);
    if (connection === 'open') log('✅ Connected & online');
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (!msg.message) {
        log("⚠️ Empty or system message");
        continue;
      }

      const from = msg.key.remoteJid;
      const isGroup = from.endsWith('@g.us');
      const sender = isGroup ? msg.key.participant : from;

      // Skip if group and message is from owner
      if (isGroup && msg.key.fromMe) {
        log('⚠️ Skipping group message from self');
        continue;
      }

      const textMsg = extractText(msg.message);
      log(`📨 ${from} | ${textMsg} | isGroup: ${isGroup}`);

      if (textMsg?.trim().toLowerCase() === 'hi') {
        const replyKey = `${from}|${msg.messageTimestamp}`;
        if (repliedMap.has(replyKey)) return;

        repliedMap.set(replyKey, true);
        setTimeout(() => repliedMap.delete(replyKey), 15_000);

        try {
          await sock.sendMessage(from, {
            text: `hello 🤗😒😒😒`,
            mentions: [sender],
          });

          if (sender === OWNER_JID) {
            await sock.sendMessage(sender, { text: `🧠 Bot received your "hi" message and replied.` });
          }

          log(`✅ Replied to ${sender}`);
        } catch (err) {
          log('❌ Failed to reply:', err);
        }
      }
    }
  });

  // Optional: force messages to load faster
  sock.ev.on('message-receipt.update', (m) => {
    try {
      if (m?.key?.remoteJid) sock.readMessages([m.key]);
    } catch (e) {
      log('⚠️ Error reading message:', e.message);
    }
  });
}

// === START EVERYTHING ===
startBot(SESSION_ID).catch(err => {
  log('❌ Bot start failed:', err);
});

// === RENDER / REPLIT WEB SERVER ===
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (_, res) => res.send('🤖 Bot is running.'));
app.listen(PORT, () => {
  log(`🌐 Web server running on port ${PORT}`);
});
