const { Client, GatewayIntentBits, Partials, PermissionsBitField } = require('discord.js');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
});

const blockedKeywords = [
  'discord.gg/', 'discord.com/invite/', 'mirror scam', 'crypto mirror', 'mirror asli',
  'postingan ini original', 'join link mirror', 'no scam', 'original milik',
  'hanya dibawah ini', 'original', 'join link', 'act', 'mirror', 'scam', 'miror'
].map(k => k.toLowerCase());

const blockedNicknames = [
  'king crypto', 'ACT', 'kingcrypto', 'kingcrypto12',
  'king crypto 12', 'captain hook', 'spidey bot'
].map(n => n.toLowerCase());

const recentBlocks = [];
const layer2Log = {
  totalDeleted: 0,
  lastTrigger: null,
  lastReason: null
};

const userMessageTimestamps = new Map();

client.on('ready', () => {
  console.log(`✅ Spamming Bots is online as ${client.user.tag}`);
  scheduleLayer2Scan();
});

client.on('messageCreate', async (message) => {
  if (!message.guild) return;
  if (message.webhookId && message.author.username === 'SpammingBotsResend') return;

  const now = Date.now();
  const userId = message.author.id;
  const content = message.content?.toLowerCase() || '';
  const displayName = message.member?.nickname || message.author.username;
  const authorName = message.member?.nickname?.toLowerCase() ||
                     message.author.globalName?.toLowerCase() ||
                     message.author.username.toLowerCase();

  const attachments = [...message.attachments.values()].map(a => a.url);

  if (!message.webhookId) {
    const history = userMessageTimestamps.get(userId) || [];
    const recent = history.filter(t => now - t < 5000);
    recent.push(now);
    userMessageTimestamps.set(userId, recent);
    if (recent.length > 5) return;
  }

  // 1. Blocked nickname
  if (blockedNicknames.some(n => authorName.includes(n))) {
    await message.delete().catch(() => {});
    recentBlocks.unshift({ user: displayName, reason: 'NICKNAME', time: now });
    if (recentBlocks.length > 10) recentBlocks.pop();
    return;
  }

  // 2. Blocked text content
  if (blockedKeywords.some(word => content.includes(word))) {
    await message.delete().catch(() => {});
    recentBlocks.unshift({ user: displayName, reason: 'CONTENT', time: now });
    if (recentBlocks.length > 10) recentBlocks.pop();
    return;
  }

  // 3. Blocked embed — just delete and skip (no resend!)
  if (message.embeds.length > 0) {
    const embedText = message.embeds.map(e => [
      e.title, e.description, e.url,
      ...(e.fields?.map(f => `${f.name} ${f.value}`) || [])
    ].join(' ')).join(' ').toLowerCase();

    if (blockedKeywords.some(word => embedText.includes(word))) {
      await message.delete().catch(() => {});
      recentBlocks.unshift({ user: displayName, reason: 'EMBED', time: now });
      if (recentBlocks.length > 10) recentBlocks.pop();
      return; // ✅ Don't resend anything, just purge and move on
    }
  }

  // 4. !status admin command
  if (content === '!status') {
    if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return message.reply("❌ You don't have permission.");
    }

    const layer1 = recentBlocks.length
      ? recentBlocks.map(b => `• **${b.reason}** - ${b.user} at ${new Date(b.time).toLocaleString()}`).join('\n')
      : '✅ No recent blocked messages from Layer 1.';

    const layer2 = layer2Log.totalDeleted > 0
      ? `🧼 Layer 2 cleaned **${layer2Log.totalDeleted}** message(s).\nLast trigger: **${layer2Log.lastReason}** at ${new Date(layer2Log.lastTrigger).toLocaleString()}`
      : '✅ No deletions yet by Layer 2.';

    return message.channel.send({
      content: `🛡️ **Security Status**\n\n🔹 **Layer 1 (Live Checks):**\n${layer1}\n\n🔸 **Layer 2 (History Clean):**\n${layer2}`,
      allowedMentions: { parse: [] }
    });
  }
});

// ⏱ Auto Layer 2 scan
function scheduleLayer2Scan() {
  setInterval(async () => {
    const now = Date.now();
    for (const guild of client.guilds.cache.values()) {
      for (const channel of guild.channels.cache.values()) {
        if (!channel.isTextBased() || !channel.viewable || !channel.permissionsFor(client.user)?.has(PermissionsBitField.Flags.ManageMessages)) continue;

        try {
          const messages = await channel.messages.fetch({ limit: 100 });
          for (const msg of messages.values()) {
            const author = msg.member?.nickname?.toLowerCase() || msg.author.username.toLowerCase();
            const text = msg.content.toLowerCase();

            if (blockedNicknames.some(n => author.includes(n))) {
              await msg.delete().catch(() => {});
              layer2Log.totalDeleted++;
              layer2Log.lastTrigger = now;
              layer2Log.lastReason = `NICKNAME (${author})`;
            } else if (blockedKeywords.some(k => text.includes(k))) {
              await msg.delete().catch(() => {});
              layer2Log.totalDeleted++;
              layer2Log.lastTrigger = now;
              layer2Log.lastReason = `CONTENT (${k})`;
            }
          }
        } catch (err) {
          console.error(`Layer 2 scan error in ${channel.name}:`, err.message);
        }
      }
    }
  }, 10 * 60 * 1000); // every 10 minutes
}

client.login(process.env.TOKEN);
