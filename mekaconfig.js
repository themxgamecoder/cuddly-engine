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
 *
 * PORT:
 * - Optional: Defaults to 3000 if not set.
 * - Use only when deploying to platforms like Render or Replit.
 */

module.exports = {
  SESSION_ID: process.env.SESSION_ID || 'mekaai_43cdf18f',
  OWNER_JID: process.env.OWNER_JID || '',
  MEKAMODE: process.env.MEKAMODE || 'meka',
  PORT: process.env.PORT || 3000,
};
