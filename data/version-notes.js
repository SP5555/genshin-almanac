// Region + a short lore tagline for each major version's story chapter,
// shown under the big "Version N" title. `label` overrides the numeral
// itself — used for major version 6, which mihoyo branded "Luna" (I/II/III)
// instead of "6.0"/"6.1"/"6.2" in official patch naming. Taglines cross-
// checked against Genshin Wiki / Wikipedia / Sportskeeda / Game8 on
// 2026-08-21 (see CLAUDE.md).
var versionMeta = {
	"1": { region: "Mondstadt & Liyue", tagline: "Anemo Archon of Freedom, Geo Archon of Contracts" },
	"2": { region: "Inazuma", tagline: "Electro Archon of Eternity" },
	"3": { region: "Sumeru", tagline: "Dendro Archon of Wisdom" },
	"4": { region: "Fontaine", tagline: "Hydro Archon of Justice" },
	"5": { region: "Natlan", tagline: "Pyro Archon of War" },
	"6": { region: "Nod-Krai", label: "Luna", tagline: "Song of the Welkin Moon" },
	"7": { region: "Snezhnaya", tagline: "Cryo Archon — the ninth and final of The Seven" }
};
