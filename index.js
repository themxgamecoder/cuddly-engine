const fs = require('fs');
const path = require('path');
const express = require('express');
const pino = require('pino');
const { MongoClient } = require('mongodb');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
} = require('@whiskeysockets/baileys');

const { SESSION_ID, PORT, MEKAMODE } = require('./mekaconfig');
const app = express();

// === CONFIG ===
const MONGO_URI = 'mongodb+srv://damilaraolamilekan:damilaraolamilekan@cluster0.tglsxja.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const LOG_FILE = path.join(__dirname, 'logs.txt');
const repliedMap = new Map();
const cooldownMap = new Map();
let firstBoot = true;

fs.writeFileSync(LOG_FILE, '');
function log(...args) {
  const text = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a, null, 2))).join(' ');
  fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${text}\n`);
}

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

async function restoreSessionFromID(id) {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db('mekaSessions');
  const doc = await db.collection('sessions').findOne({ _id: id });
  if (!doc) {
    log('❌ No session found in MongoDB for ID:', id);
    process.exit(1);
  }
  const data = Buffer.from(doc.sessionData, 'base64');
  const sessionDir = path.join(__dirname, 'session');
  if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir);
  fs.writeFileSync(path.join(sessionDir, 'creds.json'), data);
  log('✅ Session restored from MongoDB:', id);
  await client.close();
}

async function startBot(id) {
  await restoreSessionFromID(id);
  const { state, saveCreds } = await useMultiFileAuthState('./session');

  const sock = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' })),
    },
    logger: pino({ level: 'fatal' }),
    browser: ['Ubuntu', 'Chrome', 'meka-bot'],
    ignoreBroadcast: false,
    syncOwn: true,
    syncFullHistory: firstBoot,
    emitOwnOnline: true,
    enableChats: true,
    fetchChats: true,
    shouldIgnoreJid: () => false,
    getMessage: async () => undefined,
  });

  sock.ev.on('creds.update', saveCreds);

  const sessionOwnerJID = state.creds.me?.id?.split(':')[0] + '@s.whatsapp.net';
  const sessionOwnerLID = state.creds.me?.lid?.split(':')[0] + '@lid';
  log('👤 Logged-in JID (raw):', state.creds.me?.id);
  log('🔍 Normalized Owner JID:', sessionOwnerJID);
  log('🔐 MEKAMODE is:', MEKAMODE);

  sock.ev.on('connection.update', ({ connection }) => {
    if (connection === 'open') {
      sock.sendPresenceUpdate('available');
      log('✅ Connected & online');
    }
  });

  sock.ev.process(async (events) => {
    if (events['messages.upsert']) {
      const { messages, type } = events['messages.upsert'];
      if (type !== 'notify') return;

      for (const msg of messages) {
        if (!msg.message) continue;

        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        const sender = isGroup ? msg.key.participant : from;
        const text = extractText(msg.message)?.trim().toLowerCase();

        log(`📨 ${from} | ${text} | isGroup: ${isGroup}`);

        if (text !== 'hi') continue;

        // Cooldown
        if (cooldownMap.has(sender)) {
          log(`⏳ Cooldown active for ${sender}`);
          continue;
        }
        cooldownMap.set(sender, true);
        setTimeout(() => cooldownMap.delete(sender), 10_000);

const isFromMe = msg.key.fromMe === true;

let isOwner = false;
if (isGroup) {
  isOwner = (sender === sessionOwnerLID);
  log(`👥 Group Msg | Sender: ${sender} | Expected Owner (LID): ${sessionOwnerLID} | isOwner: ${isOwner}`);
} else {
  isOwner = (sender === sessionOwnerJID) || isFromMe;
  log(`👤 Private Msg | Sender: ${sender} | Expected Owner (JID): ${sessionOwnerJID} | isOwner: ${isOwner}`);
}

        const replyKey = `${from}|${msg.messageTimestamp}`;
        if (repliedMap.has(replyKey)) continue;
        repliedMap.set(replyKey, true);
        setTimeout(() => repliedMap.delete(replyKey), 10_000);

        try {
          if (MEKAMODE === 'meka' && !isOwner) {
            await sock.sendMessage(from, {
              text: '😒 You\'re not the owner. Go and play somewhere else.',
              mentions: [sender],
            });
            log(`🚫 Blocked 'hi' from non-owner: ${sender}`);
            continue;
          }

          await sock.sendMessage(from, {
            text: 'hello 🤗',
            mentions: [sender],
          });

          log(`✅ Replied to ${sender}`);
        } catch (e) {
          log('❌ Send error:', e);
        }
      }
    }
  });
}

startBot(SESSION_ID).catch((err) => {
  console.error('❌ Full startup error:', err);
  log('❌ Startup error:', err?.message || err);
});

app.get('/', (_, res) => res.send('🤖 Bot running'));
app.listen(PORT, () => log(`🌐 Web server running on port ${PORT}`));
