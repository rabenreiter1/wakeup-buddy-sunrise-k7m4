export function guidanceCues(guidance){
 if(!guidance)return [];
 if(guidance.mode==='phases')return guidance.cues||[];
 if(guidance.mode==='repetitions'){
  const sets=Math.min(5,Math.max(1,guidance.sets??1)),count=Math.min(30,Math.max(0,guidance.count||0)),rest=guidance.rest??20;
  const cues=[{at:0,text:guidance.intro,kind:'prepare',set:1}];let start=guidance.start;
  for(let set=1;set<=sets;set++){
   for(let i=0;i<count;i++)cues.push({at:start+i*guidance.interval,text:String(i+1),count:i+1,set,kind:'rep'});
   const end=start+count*guidance.interval;
   if(set<sets){cues.push({at:end,text:`Pause. ${rest} Sekunden locker lassen.`,set,kind:'rest',until:end+rest});cues.push({at:end+rest,text:`Satz ${set+1}. Weiter geht’s.`,set:set+1,kind:'prepare'});start=end+rest+4;}
   else cues.push({at:end,text:'Geschafft. Lass die Bewegung ruhig ausklingen.',set,kind:'complete'});
  }
  return cues;
 }
 return [];
}
export function guidanceIssues(step){
 const g=step.guidance;if(!g)return [];
 if(step.research||step.input!=='none')return ['Geführte Abläufe brauchen eine feste Anweisung ohne Antwortfeld.'];
 if(!['phases','repetitions'].includes(g.mode))return ['Wähle eine gültige Führung.'];
 if(g.mode==='repetitions'&&(!Number.isInteger(g.count)||g.count<1||g.count>30||!Number.isFinite(g.interval)||g.interval<3||!Number.isFinite(g.start)||g.start<5))return ['Wähle 1–30 Wiederholungen, mindestens 3 Sekunden Abstand und 5 Sekunden Vorlauf.'];
 if(g.mode==='repetitions'&&(!Number.isInteger(g.sets??1)||(g.sets??1)<1||(g.sets??1)>5||!Number.isFinite(g.rest??20)||(g.rest??20)<10||(g.rest??20)>180))return ['Wähle 1–5 Sätze und 10–180 Sekunden Satzpause.'];
 const cues=guidanceCues(g);
 if(g.mode==='repetitions'&&cues.at(-1).at+6>step.minutes*60)return [`Dieser Ablauf braucht mindestens ${Math.ceil((cues.at(-1).at+6)/60)} Minuten. Erhöhe die Dauer oder verkürze den Ablauf.`];
 if(!cues.length||cues.length>161||cues.some((c,i)=>!Number.isFinite(c.at)||c.at<0||c.at>=step.minutes*60||(i&&c.at<=cues[i-1].at)||typeof c.text!=='string'||!c.text.trim()))return ['Hinweise brauchen Text und aufsteigende Zeiten innerhalb der Schrittdauer.'];
 if(cues.reduce((n,c)=>n+c.text.length,0)>1200)return ['Die gesprochenen Hinweise dürfen zusammen höchstens 1.200 Zeichen enthalten.'];
 return [];
}
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function guidanceSummary(g){
 if(g?.mode!=='repetitions')return '';
 const seconds=guidanceCues(g).at(-1)?.at+6;
 return Number.isFinite(seconds)?`${g.sets??1} × ${g.count} Wiederholungen · ${g.sets>1?(g.rest??20)+' Sek. Satzpause · ':''}mindestens ${Math.ceil(seconds/60)} Min. Schrittdauer`:'';
}
export function guidanceEditor(step){
 const g=step.guidance;
 return `<details class="guidance-editor" ${g?'open':''}><summary>Geführter Ablauf${g?' · aktiv':''}</summary><label class="label" for="guide-${step.id}">Begleitung</label><select id="guide-${step.id}" class="field-input" data-guide-mode="${step.id}" ${step.research||step.input!=='none'?'disabled':''}><option value="none">Keine</option><option value="repetitions" ${g?.mode==='repetitions'?'selected':''}>Wiederholungen zählen</option><option value="phases" ${g?.mode==='phases'?'selected':''}>Hinweise mit Pausen</option></select>${g?.mode==='repetitions'?`<label class="label">Einleitung<textarea class="field-input" maxlength="900" data-guide-field="intro" data-guide-step="${step.id}">${esc(g.intro)}</textarea></label><div class="guide-numbers">${[['sets','Sätze',1,5],['count','Wdh. pro Satz',1,30],['rest','Satzpause · Sek.',10,180],['start','Vorlauf · Sek.',5,1100],['interval','Tempo · Sek.',3,120]].map(([key,label,min,max])=>`<label>${label}<input class="field-input" type="number" min="${min}" max="${max}" data-guide-step="${step.id}" data-guide-field="${key}" value="${g[key]??(key==='sets'?1:20)}"></label>`).join('')}</div><p class="small" data-guide-summary="${step.id}">${guidanceSummary(g)}</p>`:''}${g?.mode==='phases'?`<p class="small">Eine Zeile pro Hinweis: Sekunden | gesprochener Text. Dazwischen bleibt es still.</p><textarea class="field-input" rows="6" maxlength="1500" aria-label="Zeit und Text der Hinweise" data-guide-phases="${step.id}">${esc(g.cues.map(c=>`${c.at} | ${c.text}`).join('\n'))}</textarea>`:''}<p class="small">Der Buddy führt im gewählten Tempo. Bewegungen werden nicht automatisch erkannt. Die Zeitanzeige bleibt auch ohne Audio nutzbar.</p></details>`;
}
