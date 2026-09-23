#!/usr/bin/env node
// Fetch character art from the sources in data/SOURCES.md.
// Faces + namecards: enka. Splash: Fandom File:<Name>_Wish.png → yuva420p webp.
// Does not edit data/*.json — roster/notes stay a human step.
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { ROOT, readJSON, assetPath, slug, buildCanonicalData } = require("./checks/util");

const ENKA_CHARS = "https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store/characters.json";
const ENKA_LOC = "https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store/loc.json";
const ENKA_NAMECARDS = "https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store/gi/namecards.json";
const ENKA_UI = "https://enka.network/ui";
const FANDOM_API = "https://genshin-impact.fandom.com/api.php";
const FANDOM_UA = "GenshinAlmanac/1.0 (https://genshin-almanac.netlify.app; fan project art fetch)";

const FACE_URL = code => `${ENKA_UI}/UI_AvatarIcon_${code}.png`;
const NAMECARD_URL = code => `${ENKA_UI}/UI_NameCardPic_${code}_P.jpg`;

function strip(s) {
	return s.toLowerCase().replace(/[\s\-']+/g, "");
}

function parseArgs(argv) {
	let force = false;
	let dryRun = false;
	let names = [];
	for (let a of argv) {
		if (a === "--force") force = true;
		else if (a === "--dry-run") dryRun = true;
		else if (a.startsWith("-")) {
			console.error(`Unknown flag: ${a}`);
			process.exit(2);
		} else names.push(a);
	}
	return { force, dryRun, names };
}

async function fetchJSON(url) {
	let res = await fetch(url, { headers: { "User-Agent": FANDOM_UA } });
	if (!res.ok) throw new Error(`${res.status} ${url}`);
	return res.json();
}

async function fetchBuffer(url, extraHeaders) {
	let res = await fetch(url, { headers: { "User-Agent": FANDOM_UA, ...(extraHeaders || {}) } });
	if (!res.ok) return { ok: false, status: res.status };
	return { ok: true, status: res.status, buf: Buffer.from(await res.arrayBuffer()) };
}

function writeIfAllowed(dest, buf, { force, dryRun, label }) {
	if (fs.existsSync(dest) && !force) {
		console.log(`  skip ${label} (exists: ${path.relative(ROOT, dest)})`);
		return "skip";
	}
	if (dryRun) {
		console.log(`  would write ${label} → ${path.relative(ROOT, dest)} (${buf.length} bytes)`);
		return "write";
	}
	fs.mkdirSync(path.dirname(dest), { recursive: true });
	fs.writeFileSync(dest, buf);
	console.log(`  wrote ${label} → ${path.relative(ROOT, dest)} (${buf.length} bytes)`);
	return "write";
}

function resolveRequestedName(raw, canonicalNames, aliases) {
	if (canonicalNames.has(raw)) return raw;
	let want = strip(raw);
	for (let name of canonicalNames) {
		if (strip(name) === want) return name;
		if ((aliases[name] || []).some(a => strip(a) === want)) return name;
	}
	return raw;
}

function locMatches(locName, displayName, aliases) {
	if (!locName) return false;
	let loc = strip(locName);
	if (loc === strip(displayName)) return true;
	if ((aliases[displayName] || []).some(a => strip(a) === loc)) return true;
	// JP family-given ("Kamisato Ayaka") and Western given-family ("Odette Spessiva").
	return locName.trim().split(/\s+/).some(t => strip(t) === strip(displayName));
}

function faceCodeFromSideIcon(sideIcon) {
	if (!sideIcon) return null;
	let m = sideIcon.match(/^UI_AvatarIcon_Side_(.+)$/);
	return m ? m[1] : null;
}

function namecardCodeFromIcon(icon) {
	if (!icon) return null;
	let m = String(icon).match(/UI_NameCardPic_(.+)_P/);
	return m ? m[1] : null;
}

function publishedNamecardCodes(displayName, aliases, namecards) {
	let byCode = new Map();
	for (let entry of Object.values(namecards)) {
		let code = namecardCodeFromIcon(entry.Icon);
		if (code) byCode.set(strip(code), code);
	}
	let resolved = [];
	let stems = [displayName, ...(aliases[displayName] || [])].map(n => n.replace(/\s+/g, ""));
	for (let c of stems) {
		let hit = byCode.get(strip(c));
		if (hit && !resolved.includes(hit)) resolved.push(hit);
	}
	return resolved;
}

function collectNamecardCodes(displayName, faceCode, aliases, namecards) {
	let candidates = [];
	function add(code) {
		if (code && !candidates.includes(code)) candidates.push(code);
	}
	add(faceCode);
	for (let code of publishedNamecardCodes(displayName, aliases, namecards)) add(code);
	if (candidates.length) return candidates;
	add(displayName.replace(/\s+/g, ""));
	for (let a of aliases[displayName] || []) add(a.replace(/\s+/g, ""));
	return candidates;
}

function ffmpegWebp(srcPath, destPath) {
	let r = spawnSync("ffmpeg", [
		"-y", "-i", srcPath,
		"-c:v", "libwebp", "-pix_fmt", "yuva420p", "-q:v", "80",
		destPath
	], { encoding: "utf8" });
	if (r.error && r.error.code === "ENOENT") {
		return { ok: false, reason: "ffmpeg not found on PATH" };
	}
	if (r.status !== 0) {
		return { ok: false, reason: (r.stderr || r.stdout || "ffmpeg failed").trim().split("\n").slice(-3).join(" ") };
	}
	return { ok: true };
}

async function fetchSplash(displayName, dest, opts, aliases) {
	let titles = [displayName, ...(aliases[displayName] || [])]
		.filter((n, i, all) => all.indexOf(n) === i)
		.map(n => `File:${n.replace(/ /g, "_")}_Wish.png`);
	let page = null;
	let usedTitle = null;
	for (let title of titles) {
		let api = `${FANDOM_API}?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url|size&format=json`;
		let json = await fetchJSON(api);
		let candidate = Object.values(json.query.pages)[0];
		if (candidate && candidate.missing == null && candidate.imageinfo && candidate.imageinfo[0]) {
			page = candidate;
			usedTitle = title;
			break;
		}
	}
	if (!page) {
		console.log(`  warn splash: Fandom has no Wish.png for ${displayName} yet (tried ${titles.join(", ")})`);
		return "missing";
	}
	let info = page.imageinfo[0];
	if (info.width !== 2048 || info.height !== 1024) {
		console.log(`  warn splash: ${usedTitle} is ${info.width}x${info.height}, not 2048x1024 — skipping`);
		return "missing";
	}
	if (fs.existsSync(dest) && !opts.force) {
		console.log(`  skip splash (exists: ${path.relative(ROOT, dest)})`);
		return "skip";
	}
	let got = await fetchBuffer(info.url);
	if (!got.ok) {
		console.log(`  warn splash: download ${got.status} ${info.url}`);
		return "missing";
	}
	if (opts.dryRun) {
		console.log(`  would write splash → ${path.relative(ROOT, dest)} (${got.buf.length} bytes, then ffmpeg yuva420p)`);
		return "write";
	}
	let tmp = path.join("/tmp", `gi-wish-${slug(displayName)}-${process.pid}`);
	fs.writeFileSync(tmp, got.buf);
	let conv = ffmpegWebp(tmp, dest);
	fs.unlinkSync(tmp);
	if (!conv.ok) {
		console.log(`  warn splash: ${conv.reason}`);
		return "missing";
	}
	console.log(`  wrote splash → ${path.relative(ROOT, dest)}`);
	return "write";
}

function sidecarStatus(displayName, elements, birthdays, aliases, canonicalNames) {
	let lines = [];
	if (!canonicalNames.has(displayName)) lines.push("not in data.json yet");
	if (!(displayName in elements)) lines.push("character-elements.json");
	if (!(displayName in birthdays)) lines.push("character-birthdays.json");
	if (!(displayName in aliases)) lines.push("character-aliases.json (only if they have one)");
	return lines;
}

async function fetchOne(displayName, stores, opts) {
	console.log(`\n${displayName}`);
	let { chars, locEn, namecards, aliases } = stores;
	let faceCode = null;
	let faceGot = null;
	for (let row of Object.values(chars)) {
		let locName = locEn[String(row.NameTextMapHash)];
		if (locMatches(locName, displayName, aliases)) {
			faceCode = faceCodeFromSideIcon(row.SideIconName);
			if (faceCode) {
				console.log(`  enka face code ${faceCode} (${locName})`);
				break;
			}
		}
	}
	// characters.json / loc.json often lag namecards.json. A namecard Icon
	// stem is a published enka identifier, not a guessed display-name code.
	// Only use it if the face PNG is actually there (Kirara's namecard
	// Kirara ≠ face Momoka, and that URL 404s).
	if (!faceCode) {
		for (let code of publishedNamecardCodes(displayName, aliases, namecards)) {
			faceGot = await fetchBuffer(FACE_URL(code));
			if (faceGot.ok) {
				faceCode = code;
				console.log(`  enka face code ${code} (namecards.json Icon; characters.json has no loc yet)`);
				break;
			}
			faceGot = null;
		}
	}
	if (!faceCode) {
		console.log("  error face: no enka SideIconName or namecards.json Icon matched this display name (do not guess a codename)");
		return false;
	}

	let faceDest = assetPath("faces", `${slug(displayName)}.png`);
	if (!faceGot) faceGot = await fetchBuffer(FACE_URL(faceCode));
	if (!faceGot.ok) {
		console.log(`  error face: ${faceGot.status} ${FACE_URL(faceCode)}`);
		return false;
	}
	writeIfAllowed(faceDest, faceGot.buf, { ...opts, label: "face" });

	let cardCodes = collectNamecardCodes(displayName, faceCode, aliases, namecards);
	let cardOk = false;
	for (let code of cardCodes) {
		let url = NAMECARD_URL(code);
		let got = await fetchBuffer(url);
		if (!got.ok) continue;
		console.log(`  enka namecard code ${code}`);
		writeIfAllowed(assetPath("namecards", `${slug(displayName)}.jpg`), got.buf, { ...opts, label: "namecard" });
		cardOk = true;
		break;
	}
	if (!cardOk) {
		console.log(`  error namecard: tried ${cardCodes.map(NAMECARD_URL).join(", ")}`);
		return false;
	}

	await fetchSplash(displayName, assetPath("splash", `${slug(displayName)}.webp`), opts, aliases);
	return true;
}

async function main() {
	let opts = parseArgs(process.argv.slice(2));
	if (opts.names.length === 0) {
		console.error("Usage: npm run fetch-art -- <Name> [Name...] [--force] [--dry-run]");
		console.error("  Names are display names or aliases (Shogun, \"Raiden Shogun\").");
		process.exit(2);
	}

	let data = readJSON("data.json");
	let aliases = readJSON("character-aliases.json");
	let elements = readJSON("character-elements.json");
	let birthdays = readJSON("character-birthdays.json");
	let { canonicalNames } = buildCanonicalData(data);

	console.log("Loading enka store…");
	let [chars, loc, namecards] = await Promise.all([
		fetchJSON(ENKA_CHARS),
		fetchJSON(ENKA_LOC),
		fetchJSON(ENKA_NAMECARDS)
	]);
	let locEn = loc.en || {};
	let stores = { chars, locEn, namecards, aliases };

	let failed = [];
	for (let raw of opts.names) {
		let displayName = resolveRequestedName(raw, canonicalNames, aliases);
		if (displayName !== raw) console.log(`\n${raw} → ${displayName}`);
		let ok = await fetchOne(displayName, stores, opts);
		if (!ok) failed.push(displayName);
		else {
			let missing = sidecarStatus(displayName, elements, birthdays, aliases, canonicalNames);
			if (missing.length) console.log(`  still needs a human: ${missing.join(", ")}`);
		}
	}

	if (failed.length) {
		console.error(`\nFailed: ${failed.join(", ")}`);
		process.exit(1);
	}
	console.log("\nDone.");
}

main().catch(err => {
	console.error(err);
	process.exit(1);
});
