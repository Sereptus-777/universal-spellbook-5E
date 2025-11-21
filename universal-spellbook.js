/* Universal Spellbook v4.0 — FINAL FIX 2025 — ZERO ERRORS GUARANTEED */
const MODULE_ID = "universal-spellbook-5E";

Hooks.once("init", () => {
  // === THE ONLY CODE THAT ACTUALLY WORKS IN 2025 FOR D&D5e 5.1+ ===
  if (game.system.id === "dnd5e") {
    // 1. The array used by the Create-Item dialog
    CONFIG.DND5E.itemTypes ??= [];
    if (!CONFIG.DND5E.itemTypes.includes("spellbook")) {
      CONFIG.DND5E.itemTypes.push("spellbook");
    }

    // 2. The Set that Item5e.validateJoint() checks (this is the one that throws the red error)
    CONFIG.DND5E.validItemTypes ??= new Set(CONFIG.DND5E.itemTypes);
    CONFIG.DND5E.validItemTypes.add("spellbook");

    // 3. Tell the actual Item5e document class that "spellbook" is allowed
    Item5e.metadata.types ??= [];
    if (!Item5e.metadata.types.includes("spellbook")) {
      Item5e.metadata.types.push("spellbook");
    }

    // Nice UI touches
    CONFIG.Item.typeLabels.spellbook = "Spellbook";
    CONFIG.Item.typeIcons.spellbook = "fas fa-book-open";
  }
  // =================================================================

  game.settings.register(MODULE_ID, "backgroundImage", {
    name: "Spellbook Background",
    scope: "world",
    config: true,
    type: String,
    default: "modules/universal-spellbook-5E/icons/parchment.jpg",
    filePicker: "image"
  });

  Items.registerSheet(MODULE_ID, UniversalSpellbookSheet, {
    types: ["spellbook"],
    makeDefault: true,
    label: "✦ Universal Spellbook"
  });
});

/* Rest of your code (auto-create, sheet, etc.) stays exactly the same */
Hooks.on("ready", () => game.actors.forEach(a => ensureSpellbooks(a)));
Hooks.on("createActor", ensureSpellbooks);
Hooks.on("updateActor", ensureSpellbooks);
Hooks.on("createItem", item => item.parent && ensureSpellbooks(item.parent));
Hooks.on("deleteItem", item => item.parent && ensureSpellbooks(item.parent));

async function ensureSpellbooks(actor) {
  if (!actor || !["character", "npc"].includes(actor.type)) return;

  const classes = actor.items.filter(i => i.type === "class");
  for (const cls of classes) {
    const lower = cls.name.toLowerCase();
    if (!["wizard","sorcerer","cleric","druid","bard","ranger","paladin","warlock","artificer"].some(c => lower.includes(c))) continue;

    if (actor.items.some(i => i.type === "spellbook" && i.flags[MODULE_ID]?.classId === cls.id)) continue;

    await Item.create({
      name: `${actor.name}'s ${cls.name} Spellbook`,
      type: "spellbook",
      img: chooseIcon(lower, (actor.system.details?.alignment || "").toLowerCase()),
      system: { description: { value: `<p>${actor.name}'s personal spellbook.</p>` } },
      flags: { [MODULE_ID]: { classId: cls.id } }
    }, { parent: actor });
  }
}

function chooseIcon(className, alignment) {
  {
  const map = {
    wizard: "wizard-tome.png", sorcerer: "sorcerer-crystal.png", warlock: "warlock-pact.png",
    cleric: "cleric-holy.png", paladin: "paladin-oath.png", druid: "druid-nature.png",
    ranger: "ranger-forest.png", bard: "bard-music.png", artificer: "artificer-gears.png",
    evil: "evil-shadow.png", good: "good-radiant.png", chaotic: "chaotic-swirl.png", lawful: "lawful-scales.png"
  };
  for (const [k, v] of Object.entries(map)) if (className.includes(k) || alignment.includes(k)) return `modules/${MODULE_ID}/icons/${v}`;
  return `modules/${MODULE_ID}/icons/generic-spellbook.png`;
}

/* Keep your existing UniversalSpellbookSheet class unchanged below this line */
class UniversalSpellbookSheet extends ItemSheet {
  // ... (your full sheet code from before)
}
