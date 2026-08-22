// Exceptional facts about characters/phases that data.js's plain banner history
// can't express on its own. Keyed by character name (not by occurrence) so each
// fact is stated once and applied automatically to that character's first
// tracked appearance, wherever that ends up being.
//
// rateDown:     character is not a truly exclusive/limited 5-star — already
//               available via the standard rate-down pool.
// preexisting:  character already existed before their first tracked banner
//               appearance (e.g. part of the 1.0 launch roster), so that
//               appearance isn't a real "Release".
var characterNotes = {
	"Keqing": { rateDown: true, preexisting: true },
	"Tighnari": { rateDown: true },
	"Dehya": { rateDown: true },
	"Mizuki": { rateDown: true },

	"Barbara": { preexisting: true },
	"Fischl": { preexisting: true },
	"Xiangling": { preexisting: true },
	"Noelle": { preexisting: true },
	"Sucrose": { preexisting: true },
	"Xingqiu": { preexisting: true },
	"Beidou": { preexisting: true },
	"Ningguang": { preexisting: true },
	"Chongyun": { preexisting: true },
	"Razor": { preexisting: true },
	"Bennett": { preexisting: true }
};

// Phases that are a minor/padding banner rather than a major content drop.
// Keyed as "<version>-<phase number, 1-indexed>".
var phaseNotes = {
	"1.3-2": { filler: true }
};
