export const TAGS = ['Mindfulness', 'Fitness', 'Getting things done', 'Personal Care', 'Wissen', 'Kreativität'];
export const TRACKS = [
  { id: 'none', title: 'Keine Musik', subtitle: 'Nur dein Moment' },
  { id: 'sunrise', title: 'First Light', subtitle: 'Sanfte Glocken · ruhig' },
  { id: 'focus', title: 'Soft Focus', subtitle: 'Warme Töne · konzentriert' },
  { id: 'flow', title: 'Morning Flow', subtitle: 'Leichter Rhythmus · wach' }
];
const step = (id, text, input = 'none', minutes = 2, research = false) => ({ id, message: { type: 'text', text }, input, minutes, research, timer: true });
const block = (id, title, description, tags, theme, output, steps, uses, author = 'WB Team', music = 'none') => ({ id, sourceId: id, version: 1, title, description, tags, theme, output, steps, uses, author, music, musicVolume: .25, kind: 'block' });
export const CATALOG_BLOCKS = [
  block('demo-arrive', 'Ankommen', 'Erst du. Dann der Rest der Welt.', ['Mindfulness'], 'peach', 'buddy', [step('arrive-breathe', '*Ein Moment nur für dich*\n\nSetz dich bequem hin. Atme langsam durch die Nase ein und durch den Mund aus.\n\n- Lass deine Schultern sinken.\n- Spüre, wie sich dein Bauch hebt und senkt.\n- Du musst gerade nichts leisten.'), step('arrive-stretch', '*Weck deinen Körper*\n\nStreck die Arme nach oben. Mach dich lang und lass dann alles locker.\n\nWiederhole das in deinem eigenen Tempo.', 'none', 1)], 1284, 'WB Team', 'sunrise'),
  block('demo-clear', 'Kopf frei', 'Weniger im Kopf. Mehr bei dir.', ['Mindfulness','Getting things done'], 'lilac', 'original', [step('clear-text', '*Was beschäftigt dich?*\n\nSchreib auf, was dir gerade durch den Kopf geht. Es muss weder ordentlich noch vollständig sein.\n\nVielleicht hilft dir dieser Anfang:\n- Heute freue ich mich auf …\n- Loslassen möchte ich …', 'text'), step('clear-voice', '*Deine Intention*\n\nSprich einen Satz ein, der dich heute begleiten soll. So, als würdest du einem guten Freund Mut machen.', 'voice', 1)], 946, 'WB Team', 'focus'),
  block('demo-day', 'Mein Tag', 'Ein bisschen Welt. Dein eigener Fokus.', ['Wissen','Kreativität'], 'lime', 'text', [step('day-news', 'Fasse aktuelle positive Nachrichten zu Wissenschaft und Umwelt verständlich zusammen. Nenne die Quellen und das Datum. Nutze Überschriften und Absätze.', 'none', 2, true), step('day-photo', '*Was gibt dir heute Energie?*\n\nHalte deinen Tagesfokus in einem Foto fest. Das kann dein Frühstück, ein Blick aus dem Fenster oder etwas ganz anderes sein.', 'photo', 1)], 731, 'WB Team'),
  block('community-move', 'Sanft in Bewegung', 'Drei Minuten, die deinem Körper guttun.', ['Fitness','Personal Care'], 'sky', 'original', [step('move', '*Komm in Bewegung*\n\n- Kreise deine Schultern langsam nach hinten.\n- Strecke deine Arme zur Seite.\n- Gehe eine Minute locker auf der Stelle.\n\nBleib bei Bewegungen, die sich für dich gut anfühlen.', 'none', 3)], 562, 'Mila · Community', 'flow'),
  block('community-focus', 'Eine Sache für heute', 'Ein kleiner Fokus statt einer langen Liste.', ['Getting things done'], 'rose', 'text', [step('focus', '*Was zählt heute?*\n\nWelche eine Sache möchtest du heute voranbringen? Notiere sie und den ersten kleinen Schritt dorthin.', 'text', 2)], 388, 'Jonas · Community', 'focus'),
  block('team-care', 'Zeit für dich', 'Pflege als bewusster Moment.', ['Personal Care','Mindfulness'], 'peach', 'original', [step('care', '*Bewusst frisch werden*\n\nWasche dein Gesicht mit lauwarmem Wasser. Nimm wahr, wie es sich auf deiner Haut anfühlt.\n\nLass dir Zeit. Dieser Moment gehört dir.', 'none', 2)], 0, 'WB Team', 'sunrise')
];
export const CATALOG_RITUALS = [
  { id: 'ritual-team-morning', sourceId: 'ritual-team-morning', kind: 'ritual', title: 'Mein entspannter Morgen', description: 'Ankommen, Gedanken sortieren und mit einem guten Gefühl losgehen.', theme: 'lilac', author: 'WB Team', uses: 2106, blocks: CATALOG_BLOCKS.slice(0,3) },
  { id: 'ritual-community-focus', sourceId: 'ritual-community-focus', kind: 'ritual', title: 'Klarer Kopf, leichter Start', description: 'Ein wenig Bewegung und ein klarer Fokus für deinen Tag.', theme: 'lime', author: 'Mila · Community', uses: 624, blocks: [CATALOG_BLOCKS[3], CATALOG_BLOCKS[4]] },
  { id: 'ritual-team-soft', sourceId: 'ritual-team-soft', kind: 'ritual', title: 'Ganz sanft starten', description: 'Ein kurzer Morgen mit Platz für dich.', theme: 'peach', author: 'WB Team', uses: 312, blocks: [CATALOG_BLOCKS[0], CATALOG_BLOCKS[5]] }
];
export const blockIdentity = block => block.sourceId || block.id;
export const itemTags = item => item.kind === 'ritual' || item.blocks ? [...new Set(item.blocks.flatMap(b => b.tags || []))] : item.tags || [];
export const itemMinutes = item => item.blocks ? item.blocks.reduce((n,b) => n + itemMinutes(b), 0) : item.steps.reduce((n,s) => n + s.minutes, 0);
export const defaultAlarm = () => ({ enabled: false, time: '07:00', days: [1,2,3,4,5], tone: 'sunrise' });
export const freshRitual = () => ({ id: crypto.randomUUID(), kind: 'ritual', title: '', description: '', blocks: [], theme: 'lilac', alarm: defaultAlarm() });
export const DEMO_RITUAL={...structuredClone(CATALOG_RITUALS[0]),id:'guided-morning-demo',title:'Ein guter Morgen',alarm:{...defaultAlarm(),enabled:true}};
DEMO_RITUAL.blocks[2].steps[0].message.text='Erkläre mir, was Euclid im März 2025 beobachtet hat. Nenne die wichtigsten Zahlen und die Quelle.';

DEMO_RITUAL.blocks[2].steps[0].demoResearch=true;
