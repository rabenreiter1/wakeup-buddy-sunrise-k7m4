// Local calendar dates intentionally avoid UTC conversion and its date shifts.
export function dayKey(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
export function localDay(key){const [y,m,d]=key.split('-').map(Number);return new Date(y,m-1,d,12);}
export function weekDays(selected){const start=localDay(selected);start.setDate(start.getDate()-(start.getDay()+6)%7);return Array.from({length:7},(_,i)=>{const date=new Date(start);date.setDate(date.getDate()+i);return date;});}
function currentPlansFor(data,key){
 const date=localDay(key),exceptions=(data.datePlans||[]).filter(p=>p.date===key&&data.rituals.some(r=>r.id===p.ritualId&&r.blocks.length));
 const replaced=new Set(exceptions.map(p=>p.replacesRitualId).filter(Boolean));
 const recurring=data.rituals.filter(r=>!(data.skippedDays||[]).includes(key)&&(!data.createdAt||key>=dayKey(new Date(data.createdAt)))&&r.blocks.length&&r.alarm?.enabled&&r.alarm.days.includes(date.getDay())&&!replaced.has(r.id)&&!(data.skippedPlans||[]).some(p=>p.date===key&&p.ritualId===r.id)).map(r=>({ritual:r,time:r.alarm.time,date:key,oneOff:false}));
 const special=exceptions.map(p=>({...p,ritual:data.rituals.find(r=>r.id===p.ritualId),oneOff:true})).filter(p=>p.ritual?.blocks.length);
 const ordered=list=>list.map(p=>({...p,tone:p.tone||p.ritual.alarm?.tone||'sunrise'})).sort((a,b)=>a.time.localeCompare(b.time));
 // Dated appointments replace the whole day, not only a matching time.
 return data.singleDailyPlanVersion?ordered(special.length?special:recurring).slice(0,1):ordered([...recurring,...special]);
}
// Keep dated schedule revisions. Never infer pre-migration history from today's plan.
export function captureSchedule(data,now=new Date()){
 const schedule={rituals:data.rituals,datePlans:data.datePlans||[],skippedPlans:data.skippedPlans||[],skippedDays:data.skippedDays||[],singleDailyPlanVersion:data.singleDailyPlanVersion,createdAt:data.createdAt};
 const signature=JSON.stringify(schedule),revisions=data.scheduleRevisions||(data.scheduleRevisions=[]);
 if(revisions.length&&JSON.stringify(revisions.at(-1).schedule)===signature)return;
 revisions.push({effectiveAt:revisions.length?now.toISOString():new Date(now.getFullYear(),now.getMonth(),now.getDate()).toISOString(),schedule:structuredClone(schedule)});
}
export function plansFor(data,key){
 // Past snapshots remain historical evidence. Today's editable plan must not
 // accumulate earlier versions when its time or ritual changes.
 if(data.singleDailyPlanVersion&&key>=dayKey()){
  if(key===dayKey()&&dayHasStarted(data,key)){
   const active=data.activeRun;
   if(active&&(active.scheduledDate===key||active.startedAt&&dayKey(new Date(active.startedAt))===key))return [{date:key,id:active.planKey?.split(':')[1]||active.id,ritual:active.ritual,time:active.planKey?.slice(-5)||new Date(active.startedAt).toTimeString().slice(0,5),run:{...active,ended:false,finishedCount:0}}];
   return [];
  }
  return currentPlansFor(data,key);
 }
 const revisions=data.scheduleRevisions;
 if(!revisions?.length||key>dayKey())return currentPlansFor(data,key);
 const candidates=new Map();
 for(const revision of revisions)for(const plan of currentPlansFor(revision.schedule,key))candidates.set(planKey(plan),plan);
 if(key===dayKey())for(const plan of currentPlansFor(data,key))candidates.set(planKey(plan),plan);
 return [...candidates.values()].flatMap(plan=>{
   const at=new Date(key+'T'+plan.time+':00');
   if(at>new Date())return currentPlansFor(data,key).filter(p=>planKey(p)===planKey(plan));
   const revision=revisions.filter(r=>new Date(r.effectiveAt)<=at).at(-1);
   return revision?currentPlansFor(revision.schedule,key).filter(p=>planKey(p)===planKey(plan)):[];
 }).sort((a,b)=>a.time.localeCompare(b.time));
}
export function nextPlan(data,now=new Date(),ritualId){
 for(let i=0;i<=370;i++){const date=new Date(now);date.setDate(date.getDate()+i);for(const p of plansFor(data,dayKey(date))){if(ritualId&&p.ritual.id!==ritualId)continue;const [h,m]=p.time.split(':').map(Number);const at=new Date(date);at.setHours(h,m,0,0);if(at>now)return {...p,at};}}
 return null;
}
export const planKey=p=>p?`${p.date}:${p.id||p.ritual.id}:${p.time}`:null;
export const runDay=r=>r.scheduledDate||dayKey(new Date(r.startedAt||r.date));
export const successful=r=>Boolean(r.completed&&r.totalSteps>0&&r.finishedCount===r.totalSteps);
export function morningState(data,now=new Date()){
 if(data.activeRun)return {kind:'resume',ritual:data.activeRun.ritual,run:data.activeRun};
 const today=dayKey(now),minutes=now.getHours()*60+now.getMinutes();
 const due=plansFor(data,today).filter(p=>{const [h,m]=p.time.split(':').map(Number);return h*60+m<=minutes&&!data.history.some(r=>r.planKey===planKey(p)&&r.ended);})[0];
 if(due)return {kind:'missed',ritual:due.ritual,plan:due};
 const next=nextPlan(data,now),done=data.history.some(r=>runDay(r)===today&&successful(r));
 return {kind:done?'done':next?'upcoming':'empty',ritual:next?.ritual,plan:next};
}
export function currentStreak(data,now=new Date()){
 let count=0;for(let i=0;i<370;i++){const d=new Date(now);d.setDate(d.getDate()-i);const key=dayKey(d),done=data.history.some(r=>runDay(r)===key&&successful(r));const planned=plansFor(data,key).length||data.history.some(r=>runDay(r)===key&&r.planKey);
 if(!planned)continue;if(done)count++;else if(i>0)break;}return count;
}
export function monthDays(selected){const d=localDay(selected);d.setDate(1);d.setDate(1-(d.getDay()+6)%7);return Array.from({length:42},(_,i)=>{const day=new Date(d);day.setDate(day.getDate()+i);return day;});}

export function statusForPlan(data,plan,now=new Date()){
 if(plan.run)return successful(plan.run)?'done':'partial';
 const runs=data.history.filter(r=>r.planKey===planKey(plan));
 if(runs.some(successful))return 'done';
 if(runs.some(r=>r.finishedCount>0||!r.ended)||data.activeRun?.planKey===planKey(plan))return 'partial';
 if(runs.length||plan.date<dayKey(now))return 'skipped';
 return 'planned';
}
// Aggregate appointments, not attempts: retrying a completed appointment must
// never turn the whole day back into an incomplete day.
export function dayStatus(data,key,now=new Date()){
 const plans=plansFor(data,key),keys=new Set(plans.map(planKey));
 const states=plans.map(plan=>statusForPlan(data,plan,now)),extra=new Map();
 for(const run of data.history.filter(run=>runDay(run)===key)){
  if(keys.has(run.planKey))continue;
  const identity=run.planKey||run.id;
  const state=successful(run)?'done':run.finishedCount>0||!run.ended?'partial':'skipped';
  const previous=extra.get(identity);
  if(!previous||state==='done'||previous==='skipped'&&state==='partial')extra.set(identity,state);
 }
 states.push(...extra.values());
 if(!states.length)return 'empty';
 if(states.every(state=>state==='done'))return 'done';
 if(states.some(state=>state==='done'||state==='partial'))return 'partial';
 if(states.every(state=>state==='skipped'))return 'skipped';
 return 'planned';
}
export function omitPlan(data,plan){
 if(data.singleDailyPlanVersion)data.skippedDays=[...new Set([...(data.skippedDays||[]),plan.date])];
 if(plan.oneOff){data.datePlans=(data.datePlans||[]).filter(p=>p.id!==plan.id);}
 // Removing a replacement must not make the recurring alarm reappear that day.
 const ritualId=plan.replacesRitualId||(!plan.oneOff?plan.ritual.id:null);
 if(ritualId&&!data.skippedPlans?.some(p=>p.date===plan.date&&p.ritualId===ritualId))data.skippedPlans=[...(data.skippedPlans||[]),{date:plan.date,ritualId}];
}

export function weeklyConflicts(data,ritualId,days){
 return data.rituals.filter(r=>r.id!==ritualId&&r.blocks.length&&r.alarm?.enabled&&r.alarm.days.some(day=>days.includes(day)));
}
export function assignWeeklyPlan(data,ritualId,alarm){
 const ritual=data.rituals.find(r=>r.id===ritualId);if(!ritual)throw new Error('Ritual nicht verfügbar.');
 if(alarm.enabled)for(const other of weeklyConflicts(data,ritualId,alarm.days)){
  other.alarm=structuredClone(other.alarm);
  other.alarm.days=other.alarm.days.filter(day=>!alarm.days.includes(day));
  if(!other.alarm.days.length)other.alarm.enabled=false;
 }
 ritual.alarm=structuredClone(alarm);
}
export function dayHasStarted(data,date){
 return (data.history||[]).some(run=>runDay(run)===date)||Boolean(data.activeRun&&(data.activeRun.scheduledDate===date||data.activeRun.planKey?.startsWith(date+':')||data.activeRun.startedAt&&dayKey(new Date(data.activeRun.startedAt))===date));
}
export function assignDatePlan(data,entry){
 if(entry.date<dayKey()||dayHasStarted(data,entry.date))throw new Error('Für diesen Tag wurde bereits ein Ritual begonnen. Wähle einen anderen Tag.');
 data.datePlans=[...(data.datePlans||[]).filter(p=>p.date!==entry.date&&p.id!==entry.id),entry];
 data.skippedDays=(data.skippedDays||[]).filter(date=>date!==entry.date);
}
export function migrateSingleDailyPlan(data){
 if(data.singleDailyPlanVersion)return false;
 // Keep an exact recovery copy and historic revisions before resolving conflicts.
 captureSchedule(data);
 data.schedulePolicyBackup=structuredClone({rituals:data.rituals,datePlans:data.datePlans||[],skippedPlans:data.skippedPlans||[]});
 let conflicts=0;const owners=new Map();
 for(const r of data.rituals)if(r.alarm)r.alarm=structuredClone(r.alarm);
 for(const r of [...data.rituals].sort((a,b)=>(a.alarm?.time||'').localeCompare(b.alarm?.time||''))){
  if(!r.alarm?.enabled||!r.blocks.length)continue;
  r.alarm.days=[...new Set(r.alarm.days)].filter(day=>{if(owners.has(day)){conflicts++;return false;}owners.set(day,r.id);return true;});
  if(!r.alarm.days.length)r.alarm.enabled=false;
 }
 const dates=new Set();data.datePlans=[...(data.datePlans||[])].sort((a,b)=>a.time.localeCompare(b.time)).filter(p=>{
  if(p.date<dayKey())return true;
  if(!data.rituals.some(r=>r.id===p.ritualId&&r.blocks.length))return false;
  if(dates.has(p.date)){conflicts++;return false;}dates.add(p.date);return true;
 });
 data.singleDailyPlanVersion=1;
 if(conflicts)data.planMigrationNotice=true;
 captureSchedule(data);return true;
}
