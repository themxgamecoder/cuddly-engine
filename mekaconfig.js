// === mekaconfig.js ===
require('dotenv').config();

/**
 * SESSION_ID:
 * - Required: This must match the session saved in MongoDB.
 * - Example: "mekaai_43cdf18f"
 *
 * MEKAMODE:
 * - Optional but helpful for logic separation.
 * - Use "meka" for private bot mode (one-on-one only).
 * - Use "mekaai" for public/group bot mode (multi-user).
 *
 * OWNER_JID:
 * - WhatsApp JID of the bot owner (must include country code).
 * - Example: "263711346419@s.whatsapp.net"
 * but not needed add it at your risk🙂
 * 
 * PORT:
 * - Optional: Defaults to 3000 if not set.
 * - Use only when deploying to platforms like Render or Replit.
 * 
 * MEKAREJECTCALL:
 * - Controls auto call rejection.
 * - "call" → block calls + send savage msg + notify owner
 * - "none" → ignore incoming calls
 */

module.exports = {
  SESSION_ID: process.env.SESSION_ID || '',
  OWNER_JID: process.env.OWNER_JID || '',
  MEKAMODE: process.env.MEKAMODE || 'mekaai',
  MEKAAUTOREACT: process.env.MEKAAUTOREACT || 'none', // "owner" or "everyone" or "none"
  MEKAAUTOVIEWSTATUS: process.env.MEKAAUTOVIEWSTATUS || 'offview', // "onview" or "offview"
  MEKAAUTOREAD: process.env.MEKAAUTOREAD || 'none', // "read" or "none"
  MEKAAUTOSAVESTATUS: process.env.MEKAAUTOSAVESTATUS || 'none', // "save" or "none"
  MEKAREJECTCALL: process.env.MEKAREJECTCALL || 'call', // "call" or "none"
  MEKAWARN: process.env.MEKAWARN || 3, // Max warns before removal
  PORT: process.env.PORT || 3000,
};