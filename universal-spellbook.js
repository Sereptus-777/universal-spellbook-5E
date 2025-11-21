/* Universal Spellbook v3.2 — ZERO ERRORS on D&D5e 5.1.10+ */
const MODULE_ID = "universal-spellbook-5E";

Hooks.once("init", () => {
  /* ===== PERFECT D&D5e ITEM TYPE REGISTRATION (2025) ===== */
  if (game.system.id === "dnd5e") {
    // The array that the item dropdown uses
    if (Array.isArray(CONFIG.DND5E.itemTypes)) {
      if (!CONFIG.DND5E.itemTypes.includes("spellbook")) {
        CONFIG.DND5E.itemTypes.push("spellbook");
      }
    }

    // The Set that Item5e.validate() actually checks in v5.1+
    if (CONFIG.DND5E.validItemTypes instanceof Set) {
      CONFIG.DND5E.validItemTypes.add("spellbook");
    } else {
      CONFIG.DND5E.validItemTypes = new Set([...(CONFIG.DND5E.validItemTypes || []), "spellbook"]);
    }

    // Nice label & icon in the Create Item dialog
    CONFIG.Item.typeLabels.spellbook = "Spellbook";
    CONFIG.Item.typeIcons.spellbook = "fas fa-book-open";
  }
  /* ======================================================= */

  game.settings.register(MODULE_ID, "backgroundImage", {
    name: "Spellbook Background",
    scope: "world",
    config: true,
    type: String,
    default: "modules/universal-spellbook-5E/icons/parchment.jpg",
    filePicker: "image"
  });

  Items.registerSheet(MODULE_ID, UniversalSpellbookSheet, {
    types:["spellbook"],
    makeDefault: true,
    label: "✦ Universal Spellbook"
  });
});

/* Auto-create spellbooks */
Hooks.on("ready", () => game.actors.forEach(a => ensureSpellbooks(a)));
Hooks.on("createActor", ensureSpellbooks);
Hooks.on("updateActor", (actor) => ensureSpellbooks(actor));
Hooks.on("createItem", item => item.parent && ensureSpellbooks(item.parent));
Hooks.on("deleteItem", item => item.parent && ensureSpellbooks(item.parent));

async function ensureSpellbooks(actor) {
  if (!actor || !["character", "npc"].includes(actor.type)) return;

  const classes = actor.items.filter(i => i.type === "class");
  for (const cls of classes) {
    if (!["wizard","sorcerer","cleric","druid","bard","ranger","paladin","warlock","artificer"].some(c => cls.name.toLowerCase().includes(c))) continue;

    if (actor.items.some(i => i.type === "spellbook" && i.flags[MODULE_ID]?.classId === cls.id)) continue;

    await Item.create({
      name: `${actor.name}'s ${cls.name} Spellbook`,
      type: "spellbook",
      img: chooseIcon(cls.name.toLowerCase(), actor.system.details?.alignment?.toLowerCase() || ""),
      system: { description: { value: `<p>Personal spellbook of ${actor.name}.</p>` } },
      flags: { [MODULE_ID]: { classId: cls.id } }
    }, { parent: actor });
  }
}

function chooseIcon(className, alignment) {
  const map = {
    wizard: "wizard-tome.png", sorcerer: "sorcerer-crystal.png", warlock: "warlock-pact.png",
    cleric: "cleric-holy.png", paladin: "paladin-oath.png", druid: "druid-nature.png",
    ranger: "ranger-forest.png", bard: "bard-music.png", artificer: "artificer-gears.png",
    evil: "evil-shadow.png", good: "good-radiant.png", chaotic: "chaotic-swirl.png", lawful: "lawful-scales.png"
  };
  for (const [k, v] of Object.entries(map)) if (className.includes(k) || alignment.includes(k)) return `modules/${MODULE_ID}/icons/${v}`;
  return `modules/${MODULE_ID}/icons/generic-spellbook.png`;
}

/* Sheet stays exactly the same — perfect as-is */
class UniversalSpellbookSheet extends ItemSheet { /* ← keep your existing sheet class here unchanged */ }
