
import User from "../models/User.js";
import { createRandomCaptchaText, generateCaptchaImageBuffer } from "./captcha.js";
import { AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

const MOD_CHANNEL_ID = process.env.MOD_CHANNEL_ID || "1411340085462302831";

const CONFIG = {
  sessionWindowSize: 10,
  captchaAttempts: 2,
  basePenaltyMs: 45_000,
  strikePenaltyMultiplier: 3,
  lockDurations: [0, 2 * 60 * 1000, 10 * 60 * 1000, 60 * 60 * 1000],
  captchaLength: 5,
  captchaExpireMs: 30_000,
  absoluteMinCooldown: 1500,
  suspiciousMedianMs: 2500,
  suspiciousStdevMs: 700,
  minesPerMinuteLimit: 45,
  moderateMinesPerMinute: 30,
  moderateMedianMs: 3000,
  moderateStdevMs: 1000,
};

export function ensureProtectionState(user) {
  if (!user.miningProtection) {
    user.miningProtection = {
      strikes: 0,
      lockedUntil: null,
      lastFlaggedAt: null,
      lastTimestamps: [],
      banned: false,
    };
  }
}

export function isLocked(user) {
  ensureProtectionState(user);
  if (user.miningProtection.banned) {
    return { locked: true, remainingMs: Infinity, banned: true };
  }
  if (!user.miningProtection.lockedUntil) return { locked: false, remainingMs: 0, banned: false };
  const remaining = user.miningProtection.lockedUntil.getTime() - Date.now();
  return { locked: remaining > 0, remainingMs: Math.max(0, remaining), banned: false };
}

async function sendModLog(client, embed, userId) {
  try {
    const modChannel = await client.channels.fetch(MOD_CHANNEL_ID);
    if (!modChannel?.isTextBased?.()) return;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`lift_${userId}`).setLabel("Lift Suspension").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`clear_${userId}`).setLabel("Clear Strikes").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`ban_${userId}`).setLabel("Ban Mining").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`unban_${userId}`).setLabel("Unban Mining").setStyle(ButtonStyle.Success),
    );

    await modChannel.send({ embeds: [embed], components: [row] });
  } catch (e) {
    console.error("Failed to notify mod channel:", e);
  }
}

export async function analyzeAttemptAndMaybeRequireCaptcha(user, {
  timeSince = Infinity,
  adaptiveCooldown = 5000,
  client = null,
  medianInterval = null,
  stdevInterval = null,
  minesPerMinute = 0
} = {}) {
  ensureProtectionState(user);

  const tooFastStrong = timeSince < CONFIG.absoluteMinCooldown;
  const tooManyStrong = minesPerMinute > CONFIG.minesPerMinuteLimit;
  const tooRegularStrong = (medianInterval !== null && medianInterval < CONFIG.suspiciousMedianMs && stdevInterval !== null && stdevInterval < CONFIG.suspiciousStdevMs);

  if (tooFastStrong || tooManyStrong || tooRegularStrong) {
    await applyStrikeAndLock(user, { reason: "Strong anti-automine detection (fast/regular/RPM)", client });
    return { requireCaptcha: false, immediateLock: true };
  }

  const tooManyModerate = minesPerMinute > CONFIG.moderateMinesPerMinute;
  const tooRegularModerate = (medianInterval !== null && medianInterval < CONFIG.moderateMedianMs && stdevInterval !== null && stdevInterval < CONFIG.moderateStdevMs);
  const tooFastModerate = timeSince < (CONFIG.absoluteMinCooldown * 2);

  if (tooManyModerate || tooRegularModerate || tooFastModerate) {
    const strikes = user.miningProtection.strikes || 0;
    const penaltyMs = CONFIG.basePenaltyMs * Math.pow(CONFIG.strikePenaltyMultiplier, Math.max(0, strikes));
    const text = createRandomCaptchaText(CONFIG.captchaLength);

    let buffer = null;
    try {
      buffer = await generateCaptchaImageBuffer(text);
    } catch (err) {
      buffer = null;
    }

    const captcha = {
      text,
      buffer,
      expiresAt: Date.now() + CONFIG.captchaExpireMs,
      attemptsLeft: CONFIG.captchaAttempts,
      penaltyMs,
    };

    user.miningProtection.lastFlaggedAt = new Date();
    try { await user.save(); } catch {}

    if (client) {
      const embed = {
        title: "Anti-automine check triggered (heuristic)",
        description: `User <@${user.userId}> triggered an anti-autominer check.\n**Strikes:** ${user.miningProtection.strikes || 0}\n**Details:** median=${medianInterval || "n/a"}ms stdev=${stdevInterval || "n/a"}ms RPM=${minesPerMinute}\n**Reason:** heuristic suspicion.`,
        timestamp: new Date(),
        color: 0xffcc00,
      };
      await sendModLog(client, embed, user.userId);
    }

    return { requireCaptcha: true, captcha };
  }

  return { requireCaptcha: false };
}

export async function applyStrikeAndLock(user, { reason = "Unknown", client = null } = {}) {
  ensureProtectionState(user);
  user.miningProtection.strikes = (user.miningProtection.strikes || 0) + 1;
  user.miningProtection.lastFlaggedAt = new Date();

  const strikes = user.miningProtection.strikes;
  let lockMs;

  if (strikes === 1) {
    lockMs = 0; 
  } else if (strikes === 2) {
    lockMs = 2 * 60 * 1000; 
  } else if (strikes === 3) {
    lockMs = 10 * 60 * 1000; 
  } else if (strikes === 4) {
    lockMs = 60 * 60 * 1000; 
  } else if (strikes === 5) {
    lockMs = 6 * 60 * 60 * 1000; 
  } else if (strikes === 6) {
    lockMs = 24 * 60 * 60 * 1000; 
  } else {
    lockMs = Number.MAX_SAFE_INTEGER; 
  }

  user.miningProtection.lockedUntil = new Date(Date.now() + lockMs);

  try { await user.save(); } catch (e) {  }

  if (client) {
    try {
      const modChannel = await client.channels.fetch(MOD_CHANNEL_ID);
      if (modChannel?.isTextBased?.()) {
        const embed = {
          title: "User locked for suspicious mining",
          description: `User <@${user.userId}> was locked from mining.\n**Strikes:** ${strikes}\n**Duration:** ${lockMs === Number.MAX_SAFE_INTEGER ? "Permanent" : Math.ceil(lockMs/1000)}s\n**Reason:** ${reason}`,
          timestamp: new Date(),
          color: 0xff0000
        };
        await modChannel.send({ embeds: [embed] }).catch(()=>{});
      }
    } catch (e) {
      console.error("Failed to notify mod channel:", e);
    }
  }
}

export async function handleCaptchaFailure(user, { reason = "Captcha failed", client = null } = {}) {
  await applyStrikeAndLock(user, { reason, client });
}

export async function clearStrikes(user, actor = "moderator") {
  ensureProtectionState(user);
  user.miningProtection.strikes = 0;
  user.miningProtection.lockedUntil = null;
  user.miningProtection.lastFlaggedAt = new Date();
  try { await user.save(); } catch {}
  return user;
}

export async function liftSuspension(user, actor = "moderator") {
  ensureProtectionState(user);
  user.miningProtection.lockedUntil = null;
  try { await user.save(); } catch {}
  return user;
}

export async function banUserFromMining(user, actor = "moderator") {
  ensureProtectionState(user);
  user.miningProtection.banned = true;
  user.miningProtection.lockedUntil = new Date(8640000000000000);
  try { await user.save(); } catch {}
  return user;
}

export async function unbanUserFromMining(user, actor = "moderator") {
  ensureProtectionState(user);
  user.miningProtection.banned = false;
  user.miningProtection.lockedUntil = null;
  try { await user.save(); } catch {}
  return user;
}