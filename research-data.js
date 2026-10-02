// Verified editorial snapshot. Never labelled as today's news or a live search.
export const EUCLID = {
 date:'19.03.2025', source:'ESA',
 url:'https://www.esa.int/Science_Exploration/Space_Science/Euclid/Euclid_opens_data_treasure_trove_offers_glimpse_of_deep_fields',
 text:'*26 Millionen Galaxien.*\n\nDas Weltraumteleskop Euclid hat in nur einer Woche Beobachtungen 26 Millionen Galaxien erfasst. Die ESA veröffentlichte die Daten am 19. März 2025.\n\n*Ein neuer Blick ins All*\nDie Aufnahmen zeigen drei tiefe Himmelsfelder. Zusammen decken sie etwa 63 Quadratgrad ab – mehr als die 300-fache Fläche des Vollmonds.\n\nAstronominnen und Astronomen können darin unter anderem die Formen von Galaxien, ihre Sternentstehung und Gravitationslinsen untersuchen.'
};
export function researchFor(step,state){
 if(!step.research)return null;
 if(state?.researchResult)return state.researchResult;
 return step.demoResearch?{...EUCLID,retrievedAt:'2025-03-19T00:00:00.000Z',sources:[{id:1,title:'ESA · redaktionelles Beispiel vom 19.03.2025',url:EUCLID.url}]}:null;
}
export function resolveStepOutput(step,state){
 if(!step.research)return {kind:'original',text:step.message?.text||'',source:null};
 const source=researchFor(step,state);return source?{kind:'research',text:source.text,source}:{kind:'unavailable',text:'',source:null};
}
