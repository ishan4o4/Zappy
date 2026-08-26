import { shopItems } from "../config/shopItems.js";

export async function updateMinionStorage(minion) {
  const now = new Date();
  const lastCollected = new Date(minion.lastCollected);
  console.log(`Updating minion ${minion.minionId}: lastCollected=${lastCollected}, now=${now}`);

  const baseIdMatch = minion.minionId.match(/^([a-zA-Z0-9_]+?)(?:_\d+)?$/);
  const baseId = baseIdMatch ? baseIdMatch[1] : minion.minionId;

  const shopData = shopItems.Minions.find(m => m.id === baseId);
  if (!shopData) {
    console.warn(`Shop data not found for minion baseId: ${baseId}`);
    return minion;
  }

  const secondsPassed = Math.floor((now - lastCollected) / 1000);
  if (secondsPassed <= 0) {
    console.log("No seconds passed since lastCollected, skip mining");
    return minion;
  }

  const cycles = Math.floor(secondsPassed / shopData.speed);
  if (cycles <= 0) {
    console.log("No full cycles since lastCollected, skip mining");
    return minion;
  }

  console.log(`Mining cycles to process: ${cycles}`);

  let totalYield = 0;
  for (let i = 0; i < cycles; i++) {
    const yieldPerCycle = Math.floor(
      Math.random() * (shopData.yield.max - shopData.yield.min + 1)
    ) + shopData.yield.min;
    totalYield += yieldPerCycle;
  }
  console.log(`Total ores mined in cycles: ${totalYield}`);

  const availableStorage = minion.capacity - minion.storage;
  console.log(`Current storage: ${minion.storage}, capacity: ${minion.capacity}, available space: ${availableStorage}`);

  const oresToAdd = Math.min(totalYield, availableStorage);
  if (oresToAdd <= 0) {
    console.log("Storage full or no ores to add.");
    minion.lastCollected = now;
    await minion.save();
    return minion;
  }

  minion.storage += oresToAdd;
  minion.lastCollected = now;
  try {
    await minion.save();
    console.log(`Storage updated to ${minion.storage} for minion ${minion.minionId}`);
  } catch (error) {
    console.error("Failed to save minion:", error);
  }

  return minion;
}

export function getShopMinion(minionId) {
  return shopItems.Minions.find(m => m.id === minionId);
}

export function getOreData(oreId) {
  return shopItems.Ores.find(o => o.id === oreId);
}

export function calculateMiningProgress(minion, shopData, currentTime = new Date()) {
  const secondsSinceLastCollection = Math.floor((currentTime - minion.lastCollected) / 1000);
  const completedCycles = Math.floor(secondsSinceLastCollection / shopData.speed);
  const cycleProgress = secondsSinceLastCollection % shopData.speed;
  const progressPercentage = Math.floor((cycleProgress / shopData.speed) * 100);

  return {
    secondsSinceLastCollection,
    completedCycles,
    cycleProgress,
    progressPercentage
  };
}

export function calculatePotentialOres(completedCycles, shopData) {
  let totalOres = 0;
  
  for (let i = 0; i < completedCycles; i++) {
    const oreAmount = Math.floor(
      Math.random() * (shopData.yield.max - shopData.yield.min + 1)
    ) + shopData.yield.min;
    totalOres += oreAmount;
  }
  
  return totalOres;
}

export function createProgressBar(percentage, length = 10) {
  const filledBars = Math.floor((percentage / 100) * length);
  const emptyBars = length - filledBars;
  return "▓".repeat(filledBars) + "░".repeat(emptyBars);
}

export function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

export function getMinionStatus(minion, shopData, currentTime = new Date()) {
  const progress = calculateMiningProgress(minion, shopData, currentTime);
  const potentialOres = calculatePotentialOres(progress.completedCycles, shopData);
  const actualStorage = Math.min(minion.storage + potentialOres, minion.capacity);
  
  const isFull = actualStorage >= minion.capacity;
  const hasOres = potentialOres > 0;

  if (isFull) {
    return {
      emoji: "🔴",
      text: "Storage Full!",
      color: "Red"
    };
  } else if (hasOres) {
    return {
      emoji: "🟡",
      text: "Ready to Collect",
      color: "Yellow"
    };
  } else {
    return {
      emoji: "🟢",
      text: "Mining...",
      color: "Green"
    };
  }
}

export function validateSlotNumber(slotNum, maxSlots = 5) {
  const num = parseInt(slotNum, 10);
  
  if (isNaN(num) || num < 1 || num > maxSlots) {
    return {
      valid: false,
      error: `Slot number must be between 1 and ${maxSlots}`
    };
  }
  
  return {
    valid: true,
    number: num
  };
}

export function groupMinionsByOre(minions) {
  const groups = {};
  
  minions.forEach(minion => {
    const shopData = getShopMinion(minion.minionId);
    if (!shopData) return;
    
    if (!groups[shopData.ore]) {
      groups[shopData.ore] = [];
    }
    
    groups[shopData.ore].push({
      minion,
      shopData
    });
  });
  
  return groups;
}