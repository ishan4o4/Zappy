import mongoose from "mongoose";

const minionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  minionId: { type: String, required: true, unique: true },
  ore: { type: String, required: true },
  startedAt: { type: Date, default: null },       // Mining start timestamp
  lastCollected: { type: Date, default: Date.now }, // Last mining collection timestamp
  storage: { type: Number, default: 0 },
  capacity: { type: Number, default: 200 },
  miningRate: { type: Number, required: true },    // Speed in seconds per mining cycle
});

export default mongoose.model("Minion", minionSchema);