const { Client, GatewayIntentBits } = require('discord.js');
const Tesseract = require('tesseract.js');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const blockedNicknames = [
  'king crypto', 'ACT', 'kingcrypto', 'kingcrypto12',
  'king crypto 12', 'captain hook', 'spidey bot'
].map(n => n.toLowerCase());

const blockedKeywords = [
  'discord.gg/',
  'discord.com/invite/',
  'mirror scam',
  'crypto mirror',
  'mirror asli',
  'postingan ini original',
  'join link mirror',
  'no scam',
  'original milik',
  'hanya dibawah ini',
  'original',
  'join link',
  'act',
  'mirror',
  'scam',
  'miror'
].map(k => k.toLowerCase());



client.on('ready', () => {
  console.log(`✅ Spamming Bots is online as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (!message.content && message.embeds.length === 0 && message.attachments.size === 0) return;

  const content = message.content.toLowerCase();
  const name = message.member?.displayName?.toLowerCase() || message.author.username.toLowerCase();

  // ❌ Nickname check
  if (blockedNicknames.some(nick => name.includes(nick))) {
    await message.delete().catch(console.error);
    return;
  }

  // ❌ Text keyword check
  if (blockedKeywords.some(word => content.includes(word))) {
    await message.delete().catch(console.error);
    return;
  }

  // ❌ Immediate embed check
  if (message.embeds.length > 0) {
    const embedText = message.embeds.map(embed => [
      embed.title,
      embed.description,
      embed.url,
      ...(embed.fields?.map(f => `${f.name} ${f.value}`) || [])
    ].join(' ')).join(' ').toLowerCase();

    if (blockedKeywords.some(word => embedText.includes(word))) {
      await message.delete().catch(console.error);
      return;
    }
  }

  // ✅ Delayed embed preview check (e.g. discord.gg)
  setTimeout(async () => {
    try {
      const fetched = await message.channel.messages.fetch(message.id);
      if (fetched.embeds.length > 0) {
        const embedText = fetched.embeds.map(embed => [
          embed.title,
          embed.description,
          embed.url,
          ...(embed.fields?.map(f => `${f.name} ${f.value}`) || [])
        ].join(' ')).join(' ').toLowerCase();

        if (blockedKeywords.some(word => embedText.includes(word))) {
          await fetched.delete().catch(console.error);
        }
      }
    } catch (err) {
      console.error('Preview embed check error:', err);
    }
  }, 1000);

  // 🖼️ OCR for all channels
  for (const attachment of message.attachments.values()) {
      if (!attachment.contentType?.startsWith('image/')) continue;

      try {
        const result = await Tesseract.recognize(attachment.url, 'eng');
        const ocrText = result.data.text.toLowerCase();

        if (blockedKeywords.some(word => ocrText.includes(word))) {
          await message.delete().catch(console.error);
          return;
        }
      } catch (err) {
        console.error('OCR error:', err);
      }
    }
  }
});

client.login(process.env.TOKEN);
