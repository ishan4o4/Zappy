import Minion from "./models/Minion.js";
import { shopItems } from "./config/shopItems.js";

async function miningBackgroundTask() {
  try {
    const activeMinions = await Minion.find({ startedAt: { $ne: null } });
    const now = new Date();

    for (const minion of activeMinions) {
      const baseIdMatch = minion.minionId.match(/^([a-zA-Z0-9_]+?)(?:_\d+)?$/);
      const baseId = baseIdMatch ? baseIdMatch[1] : minion.minionId;
      const shopData = shopItems.Minions.find(m => m.id === baseId);
      if (!shopData) continue;

      const secondsElapsed = Math.floor((now - minion.lastCollected) / 1000);
      const cyclesElapsed = Math.floor(secondsElapsed / shopData.speed);
      if (cyclesElapsed <= 0) continue;

      let totalYield = 0;
      for (let i = 0; i < cyclesElapsed; i++) {
        const yieldPerCycle = Math.floor(Math.random() * (shopData.yield.max - shopData.yield.min + 1)) + shopData.yield.min;
        totalYield += yieldPerCycle;
      }

      const availableStorage = minion.capacity - minion.storage;
      const oresToAdd = Math.min(totalYield, availableStorage);
      if (oresToAdd > 0) {
        minion.storage += oresToAdd;
      }

      minion.lastCollected = now;

      try {
        await minion.save();
        // console.log(`Minion ${minion.minionId}: +${oresToAdd} ores (storage: ${minion.storage}/${minion.capacity})`);
      } catch (err) {
        console.error(`Failed saving minion ${minion.minionId}:`, err);
      }
    }
  } catch (err) {
    console.error("Error in mining background task:", err);
  }
}

export function startMiningTask(intervalMs = 60 * 1000) {
  // Run immediately then at interval
  miningBackgroundTask();
  return setInterval(miningBackgroundTask, intervalMs);
}