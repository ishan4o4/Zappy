import { ActivityType } from "discord.js";

export const presences = (prefix) => [
  { status: "online", activities: [{ name: `${prefix}help for commands`, type: ActivityType.Playing }] },
  { status: "idle", activities: [{ name: "Mining economy", type: ActivityType.Playing }] },
  { status: "dnd", activities: [{ name: "Managing the bank", type: ActivityType.Watching }] },
  { status: "online", activities: [{ name: "Made by Ishan", type: ActivityType.Listening }] },
];

let activePresenceIndex = 0;

export async function setPresence(client, prefix) {
  if (!client?.user) return;
  const presenceList = presences(prefix);
  const presence = presenceList[activePresenceIndex];

  try {
    await client.user.setPresence({
      status: presence.status,
      activities: presence.activities,
    });
    
  } catch (error) {
    console.error("❌ Failed to set presence:", error);
  }

  activePresenceIndex = (activePresenceIndex + 1) % presenceList.length;
}

export function startPresenceRotation(client, prefix, interval = 5000) {
  
  setPresence(client, prefix);
  
  setInterval(() => setPresence(client, prefix), interval);
}