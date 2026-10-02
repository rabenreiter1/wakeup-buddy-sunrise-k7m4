export function guidanceCues(guidance){
 if(!guidance)return [];
 if(guidance.mode==='phases')return guidance.cues||[];
 if(guidance.mode==='repetitions')return [{at:0,text:guidance.intro},...Array.from({length:Math.min(30,Math.max(0,guidance.count||0))},(_,i)=>({at:guidance.start+i*guidance.interval,text:String(i+1),count:i+1}))];
 return [];
}
export function guidanceIssues(step){
 const g=step.guidance;if(!g)return [];
 if(step.research||step.input!=='none')return ['Geführte Abläufe brauchen eine feste Anweisung ohne Antwortfeld.'];
 if(!['phases','repetitions'].includes(g.mode))return ['Wähle eine gültige Führung.'];
 if(g.mode==='repetitions'&&(!Number.isInteger(g.count)||g.count<1||g.count>30||!Number.isFinite(g.interval)||g.interval<3||!Number.isFinite(g.start)||g.start<5))return ['Wähle 1–30 Wiederholungen, mindestens 3 Sekunden Abstand und 5 Sekunden Vorlauf.'];
 const cues=guidanceCues(g);
 if(!cues.length||cues.length>31||cues.some((c,i)=>!Number.isFinite(c.at)||c.at<0||c.at>=step.minutes*60||(i&&c.at<=cues[i-1].at)||typeof c.text!=='string'||!c.text.trim()))return ['Hinweise brauchen Text und aufsteigende Zeiten innerhalb der Schrittdauer.'];
 if(cues.reduce((n,c)=>n+c.text.length,0)>1200)return ['Die gesprochenen Hinweise dürfen zusammen höchstens 1.200 Zeichen enthalten.'];
 return [];
}
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function guidanceEditor(step){
 const g=step.guidance;
 return `<details class="guidance-editor" ${g?'open':''}><summary>Geführter Ablauf${g?' · aktiv':''}</summary><label class="label" for="guide-${step.id}">Begleitung</label><select id="guide-${step.id}" class="field-input" data-guide-mode="${step.id}" ${step.research||step.input!=='none'?'disabled':''}><option value="none">Keine</option><option value="repetitions" ${g?.mode==='repetitions'?'selected':''}>Wiederholungen zählen</option><option value="phases" ${g?.mode==='phases'?'selected':''}>Hinweise mit Pausen</option></select>${g?.mode==='repetitions'?`<label class="label">Einleitung<textarea class="field-input" maxlength="900" data-guide-field="intro" data-guide-step="${step.id}">${esc(g.intro)}</textarea></label><div class="guide-numbers">${[['count','Wiederholungen',1,30],['start','Start nach Sek.',5,1100],['interval','Abstand in Sek.',3,120]].map(([key,label,min,max])=>`<label>${label}<input class="field-input" type="number" min="${min}" max="${max}" data-guide-step="${step.id}" data-guide-field="${key}" value="${g[key]}"></label>`).join('')}</div>`:''}${g?.mode==='phases'?`<p class="small">Eine Zeile pro Hinweis: Sekunden | gesprochener Text. Dazwischen bleibt es still.</p><textarea class="field-input" rows="6" maxlength="1500" aria-label="Zeit und Text der Hinweise" data-guide-phases="${step.id}">${esc(g.cues.map(c=>`${c.at} | ${c.text}`).join('\n'))}</textarea>`:''}<p class="small">Der Buddy führt im gewählten Tempo. Bewegungen werden nicht automatisch erkannt. Die Zeitanzeige bleibt auch ohne Audio nutzbar.</p></details>`;
}
