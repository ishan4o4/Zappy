export const MINION_CONSTANTS = {
  MAX_SLOTS: 5,
  DEFAULT_CAPACITY: 200,
  PROGRESS_BAR_LENGTH: 10,
  
  COLORS: {
    SUCCESS: "Green",
    ERROR: "Red", 
    WARNING: "Orange",
    INFO: "Blue",
    DEFAULT: "Gold"
  },
  
  EMOJIS: {
    ACTIVE: "🟢",
    READY: "🟡", 
    FULL: "🔴",
    INACTIVE: "⚫",
    MINING: "⛏️",
    STORAGE: "📦",
    SPEED: "⚡",
    COINS: "🪙",
    PROGRESS: "📊",
    TIME: "⏰"
  },
  
  MESSAGES: {
    NO_MINIONS: "You don't own any minions yet!",
    NO_ACTIVE_MINIONS: "You don't have any minions currently working!",
    INVALID_SLOT: "Please specify a valid slot number",
    EMPTY_SLOT: "No minion found in that slot",
    MINION_NOT_FOUND: "You don't own this minion!",
    ALREADY_EQUIPPED: "This minion is already working!",
    SLOT_OCCUPIED: "This slot is already occupied!",
    NOTHING_TO_COLLECT: "No ores have been mined since last collection",
    INSUFFICIENT_SLOTS: "You don't have enough minion slots!"
  }
};