import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  balance: { type: Number, default: 0 },
  lastDaily: { type: Number, default: 0 },
  dailyStreak: { type: Number, default: 0 },
  lastStreakReset: { type: Date, default: null },
  lastMined: { type: Number, default: 0 },
  agreedToTerms: {
    type: Boolean,
    default: false
  },
  agreedAt: {
    type: Date,
    default: null
  },
  bank: {
    hasAccount: { type: Boolean, default: false },
    loan: { type: Number, default: 0 },
    reserved: { type: Number, default: 0 },
    bankBalance: { type: Number, default: 0 }, 
    bankAccountId: { type: String, default: null },
    accountCreatedAt: { type: Date, default: null },
    lastTaxedAt: { type: Date, default: null },
    lastBankTaxedAt: { type: Date, default: null },
    lastReservedInterestAt: { type: Date, default: null },
    debt: { type: Number, default: 0 },
    loanDueAt: { type: Date, default: null },
    loanIssuedAt: { type: Date, default: null },
  },
  pickaxe: {
    name: { type: String, default: "Wooden Pickaxe" },
    durability: { type: Number, default: 100 },
    maxDurability: { type: Number, default: 100 },
    power: { type: Number, default: 1 },
  },
  inventory: {
    ores: { type: Map, of: Number, default: {} },
    pickaxes: [
      {
        id: { type: String, required: true },
        name: { type: String, required: true },
        durability: { type: Number, required: true },
        maxDurability: { type: Number, required: true },
        power: { type: Number, required: true },
        quantity: { type: Number, default: 1 },
        unlocks: [{ type: String }],
        purchasedAt: { type: Date, default: Date.now }
      }
    ],
    minions: [
      {
        id: { type: String, required: true },
        name: { type: String, required: true },
        tier: { type: Number, required: true },
        speed: { type: Number, required: true },
        storage: { type: Number, default: 0 },
        maxStorage: { type: Number, default: 200 },
        lastCollected: { type: Date, default: Date.now },
        purchasedAt: { type: Date, default: Date.now }
      }
    ]
  },
  currentPickaxeId: { type: String, default: null }, 
  minionSlots: { type: Number, default: 1 }, 

  minesCount: { type: Number, default: 0 },

  miningProtection: {
    strikes: { type: Number, default: 0 },            
    lockedUntil: { type: Date, default: null },       
    lastFlaggedAt: { type: Date, default: null },    
    lastTimestamps: { type: [Number], default: [] }, 
    
    commandCount: { type: Number, default: 0 },       
    captchaThreshold: { type: Number, default: null } 
  }
});

export default mongoose.model("User", userSchema);