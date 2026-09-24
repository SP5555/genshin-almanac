#!/usr/bin/env node
// Prints live-dot / spotlight / next-update from the same functions the
// pages import. Check the UI against this; don't treat the printout as a
// second source of truth with its own formulas.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	liveBannerState,
	nextVersionUpdate,
	versionLaunchInstant
} from "../src/shared/dates.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(fs.readFileSync(path.join(root, "data", "data.json"), "utf8"));

function parseNow(arg) {
	if (!arg) return new Date();
	if (/^\d{4}-\d{2}-\d{2}$/.test(arg)) return new Date(versionLaunchInstant(arg));
	let d = new Date(arg);
	if (isNaN(d.getTime())) {
		console.error(`Could not parse "${arg}". Use YYYY-MM-DD (06:00 CST) or a full ISO datetime.`);
		process.exit(1);
	}
	return d;
}

function iso(ms) {
	return new Date(ms).toISOString();
}

let arg = process.argv[2];
if (arg === "-h" || arg === "--help") {
	console.log("Usage: npm run when -- [YYYY-MM-DD | ISO datetime]");
	console.log("  Date-only is 06:00 China Standard Time (maintenance).");
	console.log("  No argument = right now.");
	process.exit(0);
}

let now = parseNow(arg);
let nowMs = now.getTime();
let live = liveBannerState(data, nowMs);
let next = nextVersionUpdate(data, nowMs);
let entry = live.entry;
let phase = entry ? entry.banner[live.phaseIdx] : null;

let lines = [
	`now              ${now.toISOString()}`,
	"",
	"Spotlight / live-dot  (landing heading, brand pulse, timeline live marker)",
	entry
		? [
			`  version         ${entry.version}  phase ${live.phaseIdx + 1}`,
			`  5-stars         ${(phase["5"] || []).join(", ") || "—"}`,
			`  live since      ${live.phaseStartDate}  (phase start, UTC calendar date)`,
			`  launched        ${iso(versionLaunchInstant(entry.date))}  (06:00 CST)`,
			`  days since      ${live.daysSinceLaunch.toFixed(2)}`,
			`  live-dot        ${live.isLive ? "on" : "off"}`,
			`  stale warning   ${live.stale ? "yes" : "no"}`
		].join("\n")
		: "  (no launched version yet)",
	"",
	"Next update  (Server Clocks card)",
	next
		? [
			`  live version    ${next.liveEntry.version}`,
			`  newest in data  ${next.lastEntry.version}`,
			`  badge           ${next.isUpcoming ? "Confirmed" : next.isOverdue ? "Overdue" : "Estimated"}`,
			`  target          ${iso(next.targetMs)}`
		].join("\n")
		: "  (empty data.json)"
];

console.log(lines.join("\n"));
