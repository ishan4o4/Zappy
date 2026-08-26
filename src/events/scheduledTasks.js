import { runLoanCollection, runTaxDeduction } from "../utils/bankHelpers.js"; // adjust the path accordingly

export default {
  name: "ready",
  once: true,
  async execute(client) {
    console.log("⚙️ Running scheduled maintenance tasks...");

    // Optional: prevent overlapping runs
    let isRunning = false;

    // Initial run (both)
    try {
      console.log("🚀 Initial scheduled tasks: loan collection + tax/interest...");
      await runLoanCollection(client);
      await runTaxDeduction(client);
      console.log("✅ Initial scheduled tasks completed.");
    } catch (error) {
      console.error("❌ Error during initial scheduled tasks:", error);
    }

    // Combined schedule: run both every 1 day
    setInterval(async () => {
      if (isRunning) {
        console.warn("⏳ Previous scheduled run still in progress. Skipping this tick.");
        return;
      }
      isRunning = true;

      console.log("🔁 Running scheduled loan collection + tax/interest...");
      try {
        await runLoanCollection(client);
        await runTaxDeduction(client);
        console.log("✅ Scheduled run successful.");
      } catch (error) {
        console.error("❌ Error during scheduled run:", error);
      } finally {
        isRunning = false;
      }
    }, 86400000);
  }
};