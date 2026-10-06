import { calculateBusinessMinutes } from "./lib/business-hours";

const start = new Date("2026-09-30T11:50:00.000Z"); // 08:50 BRT
const end = new Date("2026-09-30T11:54:00.000Z");   // 08:54 BRT

console.log("Minutes:", calculateBusinessMinutes(start, end));
