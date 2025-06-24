const fs = require('fs');
const path = require('path');
const { default: makeWASocket, useMultiFileAuthState, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { Storage } = require('megajs');

// === CONFIG ===
const SESSION_ID = 'mekaai_abadf913';
const LOG_FILE = path.join(__dirname, 'logs.txt');
const OWNER_JID = '2349117525115@s.whatsapp.net'; // Replace with actual owner JID
let repliedMap = new Map(); // Prevent duplicate replies

// === LOGGING ===
fs.writeFileSync(LOG_FILE, '');
function log(...args) {
  const text = args.map(a => typeof a === 'string' ? a : JSON.stringify(a, null, 2)).join(' ');
  fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${text}\n`);
}

// === MESSAGE EXTRACT ===
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

// === MEGA SESSION RESTORE ===
async function restoreSessionFromID(id) {
  const storage = new Storage({
    email: 'olamilekandamilaraaa@gmail.com',
    password: 'mxgamecoder'
  });

  await new Promise((resolve, reject) => {
    storage.login(err => err ? reject(err) : resolve());
  });

  const file = storage.root.children.find(f => f.name === `${id}.json`);
  if (!file) {
    log("❌ Session not found for ID:", id);
    process.exit(1);
  }

  const stream = file.download();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const data = Buffer.concat(chunks);

  const sessionDir = path.join(__dirname, 'session');
  if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir);

  const credsPath = path.join(sessionDir, 'creds.json');
  fs.writeFileSync(credsPath, data);
  log('✅ Session restored from MEGA with ID:', id);
}

// === START BOT ===
async function startBot(id) {
  await restoreSessionFromID(id);
  const { state, saveCreds } = await useMultiFileAuthState('./session');

  const sock = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' })),
    },
    browser: ['Ubuntu', 'Chrome', 'meka'],
    logger: pino({ level: 'fatal' }),
    ignoreBroadcast: true,
    syncFullHistory: false,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.process(async (events) => {
    if (events['connection.update']) {
      const { connection } = events['connection.update'];
      log('🔌 Connection update:', connection);
      if (connection === 'open') log('✅ Connected to WhatsApp!');
    }

    if (events['messages.upsert']) {
      const { messages, type } = events['messages.upsert'];
      log('📥 Event: messages.upsert — type:', type);
      if (type !== 'notify') return;

      for (const msg of messages) {
        if (!msg.message) {
          log("⚠️ Message is empty or protocol-only. Consider session reset.");
          continue;
        }

        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        const sender = isGroup ? msg.key.participant : from;
        const fullMsg = msg.message;
        const textMsg = extractText(fullMsg);

        log(`📨 From: ${from}, FromMe: ${msg.key.fromMe}, Group: ${isGroup}`);
        log('📩 Full Message:', fullMsg);
        log('🧠 Extracted Text:', textMsg);

        if (textMsg?.trim().toLowerCase() === 'hi') {
          const replyKey = `${from}|${msg.messageTimestamp}`;
          if (repliedMap.has(replyKey)) continue; // Prevent double reply

          repliedMap.set(replyKey, true);
          setTimeout(() => repliedMap.delete(replyKey), 10 * 1000); // Clean old entries

          try {
            await sock.sendMessage(from, {
              text: `hello 🤗`,
              mentions: [sender],
            });

            if (sender === OWNER_JID) {
              await sock.sendMessage(sender, { text: `🧠 Bot received your "hi" message and replied.` });
            }

            log(`✅ Replied to ${sender} in ${isGroup ? 'group' : 'private'}`);
          } catch (e) {
            log('❌ Send error:', e);
          }
        }
      }
    } else {
      log('⚠️ No messages.upsert in this tick.');
    }
  });
}

// === RUN ===
startBot(SESSION_ID).catch(err => {
  log('❌ Bot failed to start:', err);
});
