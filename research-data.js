// Verified editorial snapshot. Never labelled as today's news or a live search.
export const EUCLID = {
 date:'19.03.2025', source:'ESA',
 url:'https://www.esa.int/Science_Exploration/Space_Science/Euclid/Euclid_opens_data_treasure_trove_offers_glimpse_of_deep_fields',
 text:'*26 Millionen Galaxien.*\n\nDas Weltraumteleskop Euclid hat in nur einer Woche Beobachtungen 26 Millionen Galaxien erfasst. Die ESA veröffentlichte die Daten am 19. März 2025.\n\n*Ein neuer Blick ins All*\nDie Aufnahmen zeigen drei tiefe Himmelsfelder. Zusammen decken sie etwa 63 Quadratgrad ab – mehr als die 300-fache Fläche des Vollmonds.\n\nAstronominnen und Astronomen können darin unter anderem die Formen von Galaxien, ihre Sternentstehung und Gravitationslinsen untersuchen.'
};
// Deliberately fixed examples: previews never request location or live research.
// Weather, market and local examples are illustrative, not historical claims.
export const PREVIEW_SAMPLES={
 'wb-weather':'Beispielwetter: morgens kühl, später mild, mit möglichen Schauern. Shirt, leichte Jacke und ein kleiner Schirm passen dazu. Das ist keine heutige Vorhersage.',
 'wb-stocks':'Fiktives Marktbeispiel: Ein Unternehmen steigert den Umsatz, senkt aber seinen Ausblick. Ergebnis und Erwartung sind zwei verschiedene Dinge. Keine aktuellen Kurse.',
 'wb-world-news':'Aus dem Archiv, 19. März 2025: Die ESA veröffentlicht Euclid-Daten mit 26 Millionen Galaxien. Die internationale Mission untersucht damit unser Universum.',
 'wb-local':'Fiktives Stadtbeispiel: Eine Baustelle verändert den Weg zum Bahnhof. Plane mehr Zeit ein. Im echten Ritual prüft dein Buddy aktuelle Hinweise für deinen Ort.',
 'wb-tech':'Tech-Beispiel aus dem Archiv: Am 19. März 2025 veröffentlicht die ESA einen Galaxienkatalog, erstellt mit KI und freiwilligen Helfern. Die Daten sind öffentlich.',
 'wb-good-news':'Archivbeispiel vom 19. März 2025: Freiwillige halfen, Euclid-Bilder zu klassifizieren. Gemeinsam mit KI entstand ein Katalog von über 380.000 Galaxien. Quelle: ESA.',
 'wb-culture':'Fiktives Kulturbeispiel: eine Ausstellung am Nachmittag, ein Konzert am Abend. Im echten Ritual nennt dein Buddy bestätigte Termine, Orte und Quellen deiner Stadt.',
 'wb-learn':'Lernbeispiel: Merke dir Sonne, Fenster, Tasse. Schau kurz weg. Welche drei Begriffe waren es? Nenne sie aus dem Kopf und prüfe erst danach, was dir noch fehlt.'
};
export function previewResearch(block){
 const id=block.sourceId||block.id,text=PREVIEW_SAMPLES[id]||PREVIEW_SAMPLES['wb-learn'];
 return {text,preview:true,retrievedAt:'2025-03-19T00:00:00.000Z',sources:['wb-tech','wb-good-news','wb-world-news'].includes(id)?[{id:1,title:'ESA · Archivbeispiel vom 19.03.2025',url:EUCLID.url}]:[]};
}
export function researchFor(step,state){
 if(!step.research)return null;
 if(state?.researchResult)return state.researchResult;
 return step.demoResearch?{...EUCLID,retrievedAt:'2025-03-19T00:00:00.000Z',sources:[{id:1,title:'ESA · redaktionelles Beispiel vom 19.03.2025',url:EUCLID.url}]}:null;
}
export function resolveStepOutput(step,state){
 if(!step.research)return {kind:'original',text:step.message?.text||'',source:null};
 const source=researchFor(step,state);return source?{kind:'research',text:source.text,source}:{kind:'unavailable',text:'',source:null};
}
