
import { EmbedBuilder, AttachmentBuilder } from "discord.js";
import User from "../../models/User.js";
import { shopItems } from "../../config/shopItems.js";
import { createRandomCaptchaText, generateCaptchaImageBuffer } from "../../utils/captcha.js";
import { isLocked, analyzeAttemptAndMaybeRequireCaptcha, handleCaptchaFailure } from "../../utils/miningProtection.js";

export default {
  name: "mine",
  category: "Mining",
  description: "Mine for ores manually",
  async execute(message) {
    const prefix = process.env.PREFIX || "!";
    const zappcoinEmoji = "<:zappcoin:1410248547781185567>";
    const userId = message.author.id;
    const client = message.client;

    if (!global.__MINING_CAPTCHA_SESSIONS) global.__MINING_CAPTCHA_SESSIONS = new Map();

    const activeCaptcha = global.__MINING_CAPTCHA_SESSIONS.get(userId);
    if (activeCaptcha) {
      const timeLeft = Math.ceil((activeCaptcha.expiresAt - Date.now()) / 1000);
      return message.reply(
        `⚠️ You must complete the captcha first before mining again!\n` +
        `Type the captcha in chat. (${timeLeft > 0 ? `${timeLeft}s left` : "expired"})`
      );
    }

    const user = await User.findOne({ userId });
    if (!user) return message.reply(`❌ Register first with \`${prefix}register\`.`);

    if (!user.inventory) user.inventory = { pickaxes: [], minions: [], ores: new Map() };
    if (!user.lastMined) user.lastMined = 0;
    if (typeof user.minesCount !== "number") user.minesCount = 0;

    if (!user.miningProtection) {
      user.miningProtection = {
        strikes: 0,
        lockedUntil: null,
        lastFlaggedAt: null,
        lastTimestamps: [],
        commandCount: 0,
        captchaThreshold: null
      };
      await user.save().catch(() => { });
    }

    user.miningProtection.commandCount = (user.miningProtection.commandCount || 0) + 1;
    
    if (!user.miningProtection.captchaThreshold) {
      user.miningProtection.captchaThreshold = 8 + Math.floor(Math.random() * 7); 
    }
    
    try { await user.save(); } catch (e) {  }

    if ((user.miningProtection.commandCount || 0) >= user.miningProtection.captchaThreshold) {
      
      user.miningProtection.commandCount = 0;
      user.miningProtection.captchaThreshold = 8 + Math.floor(Math.random() * 7); 
      try { await user.save(); } catch (e) { }

      const captchaText = createRandomCaptchaText(5);
      let captchaBuffer = null;
      try { captchaBuffer = await generateCaptchaImageBuffer(captchaText); } catch (e) { captchaBuffer = null; }

      if (captchaBuffer) {
        const attachment = new AttachmentBuilder(captchaBuffer, { name: "captcha.png" });
        await message.reply({ content: `🤖 Forced anti-automine check! Type the characters you see (2 attempts).`, files: [attachment] });
      } else {
        await message.reply(`🤖 Forced anti-automine check! Type: **${captchaText}** (2 attempts).`);
      }

      const session = { answer: captchaText, attemptsLeft: 2, createdAt: Date.now(), expiresAt: Date.now() + 30000 };
      global.__MINING_CAPTCHA_SESSIONS.set(userId, session);

      const filter = m => m.author.id === userId;
      const collector = message.channel.createMessageCollector({ filter, time: 30000 });

      collector.on("collect", async (m) => {
        const s = global.__MINING_CAPTCHA_SESSIONS.get(userId);
        if (!s) return;
        if (String(m.content).trim().toUpperCase() === String(s.answer).toUpperCase()) {
          
          global.__MINING_CAPTCHA_SESSIONS.delete(userId);
          user.miningProtection.strikes = Math.max(0, (user.miningProtection.strikes || 0) - 1);
          user.miningProtection.lastTimestamps = (user.miningProtection.lastTimestamps || []).slice(-9).concat([Date.now()]);
          user.lastMined = 0;
          try { await user.save(); } catch (e) { }
          collector.stop("passed");
          return m.reply("✅ Correct! You may continue mining. Use the mine command again.");
        } else {
          s.attemptsLeft -= 1;
          if (s.attemptsLeft <= 0) {
            
            global.__MINING_CAPTCHA_SESSIONS.delete(userId);
            collector.stop("first_failed");
          } else {
            global.__MINING_CAPTCHA_SESSIONS.set(userId, s);
            await m.reply(`❌ Incorrect. Attempts left: ${s.attemptsLeft}.`);
          }
        }
      });

      collector.on("end", async (_, reason) => {
        
        if (reason === "first_failed" || reason === "time") {
          const finalText = createRandomCaptchaText(6);
          let finalBuffer = null;
          try { finalBuffer = await generateCaptchaImageBuffer(finalText); } catch (e) { finalBuffer = null; }

          if (finalBuffer) {
            const finalAttachment = new AttachmentBuilder(finalBuffer, { name: "final_captcha.png" });
            await message.reply({ content: `⚠️ Final chance before suspension! Solve this captcha correctly (1 attempt).`, files: [finalAttachment] });
          } else {
            await message.reply(`⚠️ Final chance before suspension! Type: **${finalText}**`);
          }

          const finalSession = { answer: finalText, attemptsLeft: 1, createdAt: Date.now(), expiresAt: Date.now() + 30000 };
          global.__MINING_CAPTCHA_SESSIONS.set(userId, finalSession);

          const finalCollector = message.channel.createMessageCollector({ filter, time: 30000, max: 1 });

          finalCollector.on("collect", async (m) => {
            const f = global.__MINING_CAPTCHA_SESSIONS.get(userId);
            if (!f) return;
            if (String(m.content).trim().toUpperCase() === String(f.answer).toUpperCase()) {
              
              global.__MINING_CAPTCHA_SESSIONS.delete(userId);
              user.miningProtection.strikes = Math.max(0, (user.miningProtection.strikes || 0) - 1);
              user.miningProtection.lastTimestamps = (user.miningProtection.lastTimestamps || []).slice(-9).concat([Date.now()]);
              user.lastMined = 0;
              try { await user.save(); } catch (e) { }
              finalCollector.stop("passed_final");
              return m.reply("✅ Final captcha passed. You may continue mining next time.");
            } else {
              
              global.__MINING_CAPTCHA_SESSIONS.delete(userId);
              finalCollector.stop("failed_final");
              await handleCaptchaFailure(user, { reason: "Failed forced captcha twice", client });
              return m.reply(`⛔ Wrong again! You are now suspended from mining temporarily. Run \`${prefix}appeal\` to appeal.`);
            }
          });

          finalCollector.on("end", async (_, finalReason) => {
            if (finalReason === "time" || finalReason === "idle") {
              const still = global.__MINING_CAPTCHA_SESSIONS.get(userId);
              if (still) global.__MINING_CAPTCHA_SESSIONS.delete(userId);
              await handleCaptchaFailure(user, { reason: "Final forced captcha expired", client }).catch(() => { });
            }
          });
        }
      });

      return;
    } 

    const lock = isLocked(user);
    if (lock.locked) {
      const remaining = Math.ceil(lock.remainingMs / 1000);
      return message.reply(`🔒 Your mining is temporarily locked. Try again in ${remaining}s. Run \`${prefix}appeal\` to appeal.`);
    }

    let totalStored = 0;
    for (const qty of user.inventory.ores.values()) totalStored += qty;
    const STORAGE_CAP = 1000;
    if (totalStored >= STORAGE_CAP) {
      return message.reply(`❌ Inventory full (${totalStored}/${STORAGE_CAP}). Clear ores by selling using \`${prefix}sell\` before mining.`);
    }

    if (user.inventory.pickaxes && user.inventory.pickaxes.length > 0) {
      user.inventory.pickaxes = user.inventory.pickaxes.filter(p => p && p.durability > 0);
      if (user.currentPickaxeId && !user.inventory.pickaxes.find(p => p.id === user.currentPickaxeId)) user.currentPickaxeId = null;
    }

    let currentPickaxe = null;
    let isLegacy = false;
    let pickaxeData = null;
    if (user.currentPickaxeId) {
      currentPickaxe = user.inventory.pickaxes.find(p => p.id === user.currentPickaxeId);
      pickaxeData = shopItems.Pickaxes.find(p => p.id.replace(/_/g, "_") === currentPickaxe?.id);
    }
    if (!currentPickaxe && user.pickaxe?.name) {
      currentPickaxe = user.pickaxe;
      isLegacy = true;
      pickaxeData = shopItems.Pickaxes.find(p => p.name === user.pickaxe.name);
      if (currentPickaxe.name === "Wooden Pickaxe" && currentPickaxe.durability <= 0) currentPickaxe.durability = 1;
    }
    if (!currentPickaxe) return message.reply(`❌ You don't own a pickaxe! Buy one with \`${prefix}shop\`.`);
    if (currentPickaxe.durability <= 0 && !(isLegacy && currentPickaxe.name === "Wooden Pickaxe")) return message.reply(`❌ Your pickaxe is broken!`);
    if (!pickaxeData) return message.reply("⚠️ Pickaxe data not found.");

    const powerFactor = Math.max(1, currentPickaxe.power || 1);
    const baseCooldown = 7000 + Math.floor(Math.random() * (15000 - 7000 + 1));
    const adaptiveCooldown = Math.min(15000 * (1 + powerFactor / 10), baseCooldown + powerFactor * 400);

    const now2 = Date.now();
    const timeSince2 = now2 - (user.lastMined || 0);

    if (timeSince2 < adaptiveCooldown) {
      const waitSec = Math.ceil((adaptiveCooldown - timeSince2) / 1000);
      return message.reply(`⏳ Please wait ${waitSec}s before mining again.`);
    }

    let timestamps = (user.miningProtection?.lastTimestamps || []).slice();
    timestamps.push(now2);
    const intervals2 = [];
    for (let i = 1; i < timestamps.length; i++) intervals2.push(timestamps[i] - timestamps[i - 1]);
    const medianInterval = intervals2.length ? intervals2[Math.floor(intervals2.length / 2)] : null;
    const stdevInterval = intervals2.length ? (function (vals) {
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const variance = vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / vals.length;
      return Math.sqrt(variance);
    })(intervals2) : null;
    let minesPerMinute = 0;
    if (timestamps.length >= 2) {
      const windowMs = timestamps[timestamps.length - 1] - timestamps[0];
      const perMs = timestamps.length / Math.max(windowMs, 1);
      minesPerMinute = Math.round(perMs * 60000);
    }

    const analysis = await analyzeAttemptAndMaybeRequireCaptcha(user, {
      timeSince: timeSince2,
      adaptiveCooldown,
      client,
      medianInterval,
      stdevInterval,
      minesPerMinute
    });

    if (analysis.immediateLock) {
      return message.reply(`🚫 Suspicious mining activity detected and your account has been temporarily locked. Run \`${prefix}appeal\` to appeal.`);
    }

    if (analysis.requireCaptcha) {
      const { captcha } = analysis;
      if (captcha.buffer) {
        const attachment = new AttachmentBuilder(captcha.buffer, { name: "captcha.png" });
        await message.reply({ content: `🤖 Anti-automine check! Type the characters you see in the image. You have ${captcha.attemptsLeft} attempts and ${Math.ceil((captcha.expiresAt - Date.now()) / 1000)}s.`, files: [attachment] });
      } else {
        await message.reply(`🤖 Anti-automine check! Type: **${captcha.text}**. You have ${captcha.attemptsLeft} attempts and ${Math.ceil((captcha.expiresAt - Date.now()) / 1000)}s.`);
      }

      const session = { answer: captcha.text, attemptsLeft: captcha.attemptsLeft, penaltyMs: captcha.penaltyMs, expiresAt: captcha.expiresAt, createdAt: Date.now() };
      global.__MINING_CAPTCHA_SESSIONS.set(userId, session);

      const filter = m => m.author.id === userId;
      const collector = message.channel.createMessageCollector({ filter, time: captcha.expiresAt - Date.now() });

      collector.on("collect", async (m) => {
        const s = global.__MINING_CAPTCHA_SESSIONS.get(userId);
        if (!s) return;
        if (String(m.content).trim().toUpperCase() === String(s.answer).toUpperCase()) {
          global.__MINING_CAPTCHA_SESSIONS.delete(userId);
          user.miningProtection.strikes = Math.max(0, (user.miningProtection.strikes || 0) - 1);
          user.miningProtection.lastTimestamps = (user.miningProtection.lastTimestamps || []).slice(-9).concat([Date.now()]);
          user.lastMined = 0;
          await user.save();
          collector.stop();
          await m.reply("✅ Correct! You may continue mining. Use the mine command again.");
        } else {
          s.attemptsLeft -= 1;
          if (s.attemptsLeft <= 0) {
            global.__MINING_CAPTCHA_SESSIONS.delete(userId);
            collector.stop();
            await handleCaptchaFailure(user, { reason: "Failed captcha", client });
            await m.reply(`❌ Wrong! Mining locked for ${Math.ceil(s.penaltyMs / 1000)}s.`);
          } else {
            global.__MINING_CAPTCHA_SESSIONS.set(userId, s);
            await m.reply(`❌ Incorrect. Attempts left: ${s.attemptsLeft}.`);
          }
        }
      });

      collector.on("end", () => {
        const s = global.__MINING_CAPTCHA_SESSIONS.get(userId);
        if (s) {
          global.__MINING_CAPTCHA_SESSIONS.delete(userId);
          handleCaptchaFailure(user, { reason: "Captcha expired", client }).catch(() => { });
        }
      });

      return;
    }

    user.minesCount = (user.minesCount || 0) + 1;
    user.lastMined = Date.now();

    user.miningProtection.lastTimestamps = (user.miningProtection.lastTimestamps || []).slice(-9).concat([Date.now()]);

    let removedPickaxes = [];
    if (user.inventory.pickaxes && user.inventory.pickaxes.length > 0) {
      user.inventory.pickaxes = user.inventory.pickaxes.filter(p => {
        if (p.durability <= 0) { removedPickaxes.push(p.name); return false; }
        return true;
      });
      if (user.currentPickaxeId && !user.inventory.pickaxes.find(p => p.id === user.currentPickaxeId)) user.currentPickaxeId = null;
    }

    const availableOres = (function getCumulativeOres(pickaxeDataLocal) {
      const oreUnlocks = {
        "Wooden Pickaxe": ["stone"],
        "Stone Pickaxe": ["stone", "coal", "iron"],
        "Iron Pickaxe": ["stone", "coal", "iron", "gold"],
        "Diamond Pickaxe": ["stone", "coal", "iron", "gold", "diamond"],
        "Netherite Pickaxe": ["stone", "coal", "iron", "gold", "diamond", "emerald", "netherite"]
      };
      const unlockedOreIds = oreUnlocks[pickaxeDataLocal.name] || [];
      return shopItems.Ores.filter(ore => unlockedOreIds.includes(ore.id));
    })(pickaxeData);

    const foundOres = (function performMining(availableOresLocal, power) {
      const results = [];
      const baseSwings = power + 2;
      const maxSwings = Math.min(baseSwings, 8);
      for (let swing = 0; swing < maxSwings; swing++) {
        if (Math.random() > 0.25) {
          const selectedOre = (function selectOreByRarity(availableOresInner) {
            const weights = availableOresInner.map(ore => ({
              ore, weight: (function getRarityWeight(id) {
                const rarityWeights = { 'stone': 10000, 'coal': 5000, 'iron': 2000, 'gold': 500, 'diamond': 100, 'emerald': 25, 'netherite': 5 };
                return rarityWeights[id] || 1000;
              })(ore.id)
            }));
            const total = weights.reduce((s, w) => s + w.weight, 0);
            let r = Math.random() * total;
            for (const w of weights) { r -= w.weight; if (r <= 0) return w.ore; }
            return weights[0]?.ore;
          })(availableOresLocal);
          if (selectedOre) {
            const quantity = (function calculateOreQuantity(ore, power) {
              const baseQuantity = { 'stone': 3, 'coal': 2, 'iron': 2, 'gold': 1, 'diamond': 1, 'emerald': 1, 'netherite': 1 };
              const base = baseQuantity[ore.id] || 1;
              const powerBonus = Math.floor(power / 3);
              const maxQuantity = Math.min(base + powerBonus, 5);
              return Math.floor(Math.random() * maxQuantity) + 1;
            })(selectedOre, power);
            if (quantity > 0) results.push({ ore: selectedOre, quantity, rarity: selectedOre.id });
          }
        }
      }
      return results;
    })(availableOres, currentPickaxe.power);

    let totalValue = 0;
    const consolidated = [];
    for (const f of foundOres) {
      const curr = user.inventory.ores.get(f.ore.id) || 0;
      user.inventory.ores.set(f.ore.id, curr + f.quantity);
      const val = f.ore.value * f.quantity;
      totalValue += val;
      const ex = consolidated.find(e => e.ore.id === f.ore.id);
      if (ex) { ex.quantity += f.quantity; ex.value += val; } else consolidated.push({ ore: f.ore, quantity: f.quantity, value: val, rarity: f.rarity });
    }

    const strikes = (user.miningProtection?.strikes) || 0;
    const rewardReductionMultiplierForStrikes = 0.5;
    if (strikes > 0) totalValue = Math.floor(totalValue * rewardReductionMultiplierForStrikes);

    if (isLegacy) { if (user.pickaxe.name !== "Wooden Pickaxe") user.pickaxe.durability = Math.max(0, user.pickaxe.durability - 1); }
    else { const invPick = user.inventory.pickaxes.find(p => p.id === currentPickaxe.id); if (invPick) invPick.durability = Math.max(0, invPick.durability - 1); }

    await user.save();

    const pickaxeEmoji = (function getPickaxeEmoji(pickaxeId) {
      const normalizedId = pickaxeId?.replace(/_/g, '_');
      const pickaxeDataFound = shopItems.Pickaxes.find(p => p.id === normalizedId || p.id === pickaxeId || p.id.replace(/_/g, '_') === normalizedId);
      return pickaxeDataFound?.emoji?.replace(/_/g, '_') || "⛏️";
    })(currentPickaxe.id);

    let desc = "";
    if (consolidated.length === 0) desc = "🕳️ **No ores found this time!**";
    else {
      consolidated.sort((a, b) => ({ "stone": 1, "coal": 2, "iron": 3, "gold": 4, "diamond": 5, "emerald": 6, "netherite": 7 }[a.ore.id] - ({ "stone": 1, "coal": 2, "iron": 3, "gold": 4, "diamond": 5, "emerald": 6, "netherite": 7 }[b.ore.id])));
      desc = consolidated.map(f => `${f.ore.emoji} **${f.ore.name}** x${f.quantity}`).join("\n");
    }
    if (removedPickaxes && removedPickaxes.length) desc += `\n\n🗑️ Removed broken pickaxes: ${removedPickaxes.join(", ")}`;
    if (strikes > 0) desc += `\n\n⚠️ Notice: Your account has ${strikes} strike(s) for suspicious activity — rewards reduced.`;

    const embed = new EmbedBuilder()
      .setColor(consolidated.length ? "Green" : "Orange")
      .setTitle(`${pickaxeEmoji} Mining Results`)
      .setDescription(desc)
      .addFields({ name: "💰 Session Value", value: `${totalValue} ${zappcoinEmoji}` })
      .setFooter({ text: `⚡ Power: ${currentPickaxe.power} | Strikes: ${strikes}` });

    return message.reply({ embeds: [embed] });
  }
};