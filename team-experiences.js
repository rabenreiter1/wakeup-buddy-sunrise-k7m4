// Editorial content uses the same three-step schema as user-created blocks.
export function enrichExperiences(blocks){
 const get=id=>blocks.find(b=>b.id==='wb-'+id);
 const step=(heading,text,minutes=1,input='none',guidance)=>({message:{type:'text',text:`*${heading}*\n\n${text}`},minutes,input,research:false,timer:Boolean(guidance),...(guidance?{guidance}:{})});
 const phases=cues=>({mode:'phases',cues:cues.map(([at,text])=>({at,text}))});
 const replace=(id,steps)=>{const b=get(id);b.steps=steps.map((s,i)=>({...s,id:b.id+'-'+(i+1)}));b.contentRevision=3;};
 for(const id of ['good-news','culture','learn']){
  const b=get(id),research=b.steps.find(s=>s.research),response=b.steps.find(s=>s.input!=='none');
  const intros={
   'good-news':['Such die Substanz','Ein Lichtblick muss nicht die ganze Welt retten. Achte gleich auf zwei Dinge: Was hat sich konkret verbessert? Und was ist noch offen? Du hältst danach deinen eigenen Gedanken fest. Mach es dir bequem; der Buddy übernimmt das Lesen.'],
   culture:['Platz für etwas Schönes','Schau kurz in deinen Kalender: Welcher Abend oder freie Zeitraum gehört diese Woche dir? Behalte ihn im Kopf. Gleich hörst du Vorschläge für deinen gespeicherten Ort. Danach wählst du eine Idee und notierst deinen nächsten Schritt. Eine Reservierung passiert hier nicht.'],
   learn:['Erst vermuten, dann lernen','Heute geht es um Lernen durch aktives Abrufen. Bevor du die Erklärung hörst: Was glaubst du, bringt mehr – denselben Text noch einmal lesen oder ihn aus dem Kopf erklären? Formuliere innerlich eine Vermutung. Gleich prüfst du sie; danach erklärst du das Konzept selbst.']
  };
  replace(id,[step(...intros[id]),research,response]);
 }
 replace('boot',[
  step('Wie startest du heute?','Stell beide Füße auf den Boden. Wie wach bist du von 1 bis 10? Spüre kurz Beine, Rücken und Schultern. Wähle locker oder sehr locker. Stell zerbrechliche Dinge aus dem Weg. Bei Schmerzen lässt du die Bewegung aus; du musst hier nichts beweisen.'),
  step('Motor an, Ego aus','Gehe locker auf der Stelle. Im Sitzen hebst du abwechselnd die Fersen. Nach 30 Sekunden wechselst du zu langsamen Schulterkreisen. Der Buddy sagt dir jeden Wechsel an. Lass die Arme locker und bleib in deinem angenehmen Bewegungsbereich.',1,'none',phases([[0,'Gehe locker auf der Stelle. Im Sitzen hebst du abwechselnd die Fersen.'],[30,'Jetzt kreise langsam die Schultern nach hinten. Lass die Arme locker.'],[50,'Werde langsamer. Spüre deinen Stand. Gleich hältst du deinen Start fest.']])),
  step('Dein Startbild','Spüre noch einmal nach: Hat sich deine Wachheit verändert? Halte dann deinen Start mit einem Foto fest: Schuhe, Bewegungsplatz oder ein eigenes Fortschrittsfoto. Wenn du später vergleichen möchtest, nutze denselben Blickwinkel. Erst sicher stehen, dann fotografieren. Dein Bild bleibt auf diesem Gerät.',1,'photo')
 ]);
 replace('mobility',[
  step('Mach dir Platz','Stell einen stabilen Stuhl in Reichweite. Du kannst alle Bewegungen auch im Sitzen machen. Teste einen kleinen Schulterkreis und bewege die Fußgelenke. Wähle einen angenehmen Umfang; kein Reißen oder Nachdrücken. Der Buddy führt dich gleich durch drei ruhige Abschnitte.'),
  step('Von oben nach unten','Beginne mit langsamen Schulterkreisen nach hinten. Dann rolle von den Fersen auf die Fußballen; halte dich bei Bedarf fest. Zum Schluss hebst du abwechselnd ein Knie leicht an. Im Sitzen kreist du erst die Schultern und Füße, dann streckst du abwechselnd ein Bein. Bei Schmerzen stoppen.',2,'none',phases([[0,'Kreise die Schultern langsam nach hinten. Kleine Kreise reichen.'],[35,'Lass die Arme sinken. Rolle jetzt von den Fersen auf die Fußballen. Halte dich bei Bedarf fest.'],[75,'Hebe abwechselnd ein Knie leicht an. Im Sitzen streckst du abwechselnd ein Bein.'],[105,'Lass die Bewegung ausklingen. Was fühlt sich jetzt beweglicher an?']])),
  step('Dein Bewegungsmoment','Welche Bewegung war heute angenehm, welche möchtest du kleiner machen? Halte deinen Bewegungsplatz oder eine entspannte Position mit einem Foto fest. Das Handy bleibt während der Übung liegen. Kein perfektes Körperbild nötig – das ist dein persönliches Protokoll.',1,'photo')
 ]);
 replace('technique',[
  step('Erst den Aufbau checken','Stelle einen stabilen Stuhl ohne Rollen gegen eine Wand. Füße etwa hüftbreit. Teste einmal langsames Hinsetzen und Aufstehen; nutze die Hände, wenn sie helfen. Alternative: sitzen bleiben und abwechselnd ein Bein strecken. Bei Schmerzen stoppen. Gleich folgen zwei Sätze mit je sechs Wiederholungen und 15 Sekunden Pause.'),
  step('Zwei Sätze, sauber geführt','Der Buddy zählt den Beginn jeder Wiederholung. Pro Wiederholung hast du sechs Sekunden: ruhig hinsetzen und wieder aufstehen. Knie folgen der Richtung der Zehen. Nach sechs Wiederholungen folgen 15 Sekunden Pause. Im zweiten Satz darfst du die leichtere Variante wählen. Die Zählung ist ein Tempo, keine automatische Bewegungserkennung.',2,'none',{mode:'repetitions',sets:2,count:6,start:12,interval:6,rest:15,intro:'Stabiler Stand. Wir starten mit Satz eins. Sechs ruhige Wiederholungen.'}),
  step('Technik schlägt Ego','War die letzte Wiederholung so kontrolliert wie die erste? Wenn nicht, mach die nächste Runde kleiner. Fotografiere deinen Trainingsaufbau oder, wenn du möchtest, deinen Fortschritt. Erst sicher stehen, dann das Handy nehmen. Vergleiche mit dir selbst, nicht mit fremden Körpern.',1,'photo')
 ]);
 replace('training',[
  step('Ein Termin, kein Vielleicht','Notiere: Wann, wo und was trainierst du heute? Nenne die erste konkrete Aktion. Zum Beispiel: 18 Uhr, Wohnzimmer, Matte ausrollen und mein gewohntes Training starten. Plane passend zu deiner Energie. Ein Spaziergang ist ebenfalls ein Plan.',1,'text'),
  step('Mach den Start leicht','Lege jetzt Schuhe, Matte oder deine Tasche bereit. Prüfe kurz, ob dir noch etwas fehlt. Überlege dir eine kleine Alternative, falls der Tag dazwischenkommt: zehn Minuten spazieren oder diese Mobilitätsrunde. Du bereitest den Start vor, nicht dein perfektes Sportlerleben.'),
  step('Dein Plan steht sichtbar','Fotografiere die bereitgelegten Sachen. Schau deinen Termin noch einmal an und sage deinen Plan B laut: „Wenn mein Training nicht klappt, mache ich …“. Das Foto erinnert dich später daran, dass der erste Schritt schon erledigt ist.',1,'photo')
 ]);
 replace('brain-dump',[
  step('Kein schöner Text nötig','Nimm eine bequeme Position ein. Gleich bekommst du zwei Minuten, um den Kopf auszukippen. Aufgaben, Gefühle, halbe Sätze: alles darf auf die Liste. Entscheide vorher, welche privaten Details du lieber nicht speichern möchtest. Dein Text bleibt lokal.'),
  step('Alle Tabs auf den Tisch','Schreib ungefiltert auf, was gerade Platz im Kopf belegt. Löse noch nichts und korrigiere keine Sätze. Wenn du stockst, beginne neu mit „Gerade denke ich an …“. Du kannst dir zwei Minuten nehmen; erst du entscheidest, wann du weitergehst.',2,'text'),
  step('Einen Tab schließen','Welche Sache auf deiner Liste kannst du heute beeinflussen? Notiere genau einen kleinen nächsten Schritt. Was nicht lösbar ist, darf eine offene Frage bleiben. Ergänze: „Für jetzt reicht …“. Du musst nicht mit einem leeren Kopf hier rausgehen.',1,'text')
 ]);
 replace('ground',[
  step('Hier darfst du ankommen','Setz dich bequem hin oder stell dich sicher auf beide Füße. Lass die Augen offen. Spüre den Kontakt zum Boden oder Stuhl. Es geht nicht darum, ein Gefühl wegzumachen. Gleich richtet der Buddy deine Aufmerksamkeit nacheinander auf Sehen, Hören und Berührung.'),
  step('Ein Sinn nach dem anderen','Sieh dich langsam um. Nimm Farben und Formen wahr. Höre dann auf die Geräusche um dich herum. Zum Schluss spüre deine Füße oder Hände. Du brauchst deinen Atem nicht zu verändern. Wenn etwas unangenehm ist, bleib einfach bei einem Gegenstand im Raum.',1,'none',phases([[0,'Finde drei Dinge, die du siehst. Schau dir ihre Farben und Formen an.'],[20,'Welche zwei Geräusche hörst du? Falls es still ist, bleib bei den Dingen, die du siehst.'],[40,'Spüre einen Kontaktpunkt: Füße auf dem Boden oder Hände auf deinem Schoß. Du bist hier.']])),
  step('Was ist jetzt da?','Sprich eine kurze Notiz: Welches Detail ist dir aufgefallen? Wie fühlst du dich gerade? Ein Satz reicht. Auch „unverändert“ ist eine vollständige Antwort. Du kannst den Moment beschreiben, ohne ihn zu bewerten.',1,'voice')
 ]);
 replace('good-move',[
  step('Wähle etwas Freundliches','Was würde dir heute ein kleines Stück helfen: Licht am Fenster, ein Glas Wasser bereitstellen, eine Pause eintragen oder eine Bitte um Hilfe entwerfen? Wähle etwas, das jetzt in einer Minute machbar ist. Kein neues Selbstoptimierungsprojekt.'),
  step('Mach deinen Move','Führe die gewählte Handlung jetzt aus. Lass das Handy liegen, wenn du die Hände brauchst. Eine kleine Handlung reicht. Der Buddy gibt dir kurz Ruhe und holt dich danach zurück.',1,'none',phases([[0,'Los geht’s. Mach jetzt die eine kleine Sache, die dir hilft.'],[45,'Komm in deinem Tempo zurück. Du hast etwas auf deine Seite gestellt.']])),
  step('Nimm es wahr','Sprich eine kurze Notiz: Was hast du gerade gemacht? Hat es etwas leichter gemacht? Wenn nicht, was könntest du beim nächsten Mal anders wählen? Kein Erfolgssatz nötig. Dein ehrlicher Eindruck zählt.',1,'voice')
 ]);
 replace('priority',[
  step('Drei Kandidaten reichen','Schreib höchstens drei Dinge auf, die heute anstehen. Formuliere sie als sichtbares Ergebnis: „Entwurf verschickt“ statt „produktiv sein“. Was heute realistisch nicht reinpasst, muss nicht auf diese Liste.',1,'text'),
  step('Entscheide dich für eins','Welche Sache macht heute den größten Unterschied? Notiere genau eine Priorität und kurz warum. Prüfe: Ist das deine Entscheidung oder nur das lauteste fremde Anliegen? Wenn alles wichtig wirkt, wähle die Sache mit der nächsten echten Frist.',1,'text'),
  step('Gib ihr einen Start','Formuliere den ersten Schritt mit einem Verb: öffnen, skizzieren, anrufen oder rechnen. Ergänze Zeitpunkt und Ort. Dein Ergebnis hier ist ein Satz: „Um … beginne ich in … mit …“. Mach den Schritt so klein, dass du sofort weißt, was zu tun ist.',1,'text')
 ]);
 replace('first-action',[
  step('Was entsteht gleich?','Öffne das Dokument oder Werkzeug deiner wichtigsten Aufgabe. Notiere hier ein winziges Ergebnis für die nächsten zwei Minuten: drei Stichpunkte, eine Rohfassung oder den ersten Rechenansatz. Schließe einen störenden Tab. Jetzt ist die Startbahn frei.',1,'text'),
  {...step('Bau die erste Version','Arbeite jetzt zwei Minuten an deinem kleinen Ergebnis. Kein Polieren, kein Themenwechsel. Wenn ein anderer Gedanke auftaucht, parke ihn auf einem Zettel. Die Uhr läuft; du darfst jederzeit früher weitergehen. Unfertig ist erlaubt.',2),timer:true},
  step('Sichere den Anschluss','Notiere, was tatsächlich entstanden ist, und den nächsten konkreten Schritt. Wenn du stecken geblieben bist: Was fehlt – eine Information, ein Werkzeug oder eine Entscheidung? Schreib genau das auf. So kannst du später direkt wieder einsteigen.',1,'text')
 ]);
 replace('fresh',[
  step('Erst du, dann der Feed','Leg bereit, was du für einen kleinen Teil deiner gewohnten Morgenpflege brauchst. Kein neues Produkt nötig. Wähle Gesicht waschen, Haare richten oder etwas Vergleichbares. Lege das Handy trocken und sicher ab.'),
  step('Eine Sache mit Aufmerksamkeit','Erledige deine gewählte Pflege in Ruhe. Nimm Temperatur, Berührung oder Geruch wahr, ohne etwas besonders machen zu müssen. Bleib bei einer Sache. Wenn du länger brauchst, pausiere den Ablauf; du bestimmst das Tempo.',1,'none',phases([[0,'Beginne mit deiner gewohnten Pflege. Nimm die Berührung und Temperatur wahr.'],[45,'Lass dir die Zeit, die du brauchst. Räume danach eine Sache wieder an ihren Platz.']])),
  step('Ein kleiner sichtbarer Start','Fotografiere deinen aufgeräumten Waschplatz, bereitgelegte Sachen oder eine andere kleine Veränderung. Es muss kein Selfie sein. Frag dich kurz: Was macht mir den nächsten Morgen leichter? Das Foto ist deine Erinnerung daran.',1,'photo')
 ]);
 replace('ideas',[
  step('Eine Frage öffnet die Tür','Notiere eine konkrete kleine Frage: Wie starte ich mein Projekt? Wie nutze ich meine Pause? Wie überrasche ich jemanden? Wähle nur eine. Eine gute Frage ist klein genug, dass du heute etwas ausprobieren könntest.',1,'text'),
  step('Fünf Ideen, keine Jury','Schreib fünf verschiedene Antworten auf deine Frage. Eine darf unpraktisch sein, eine überraschend, eine sehr einfach. Noch nichts löschen oder bewerten. Falls du stockst: Was wäre die billigste, schnellste oder freundlichste Variante?',2,'text'),
  step('Eine Idee bekommt Füße','Wähle die Idee, die du am leichtesten testen kannst. Notiere: „In zehn Minuten könnte ich …“. Woran würdest du erkennen, ob der Versuch nützlich war? Ein kleines Experiment reicht; kein fertiges Meisterwerk.',1,'text')
 ]);
 const meditation=get('meditation');
 replace('meditation',[step('Du musst nichts erreichen','Setz dich bequem hin. Lege das Handy ab und wähle offene oder geschlossene Augen. Spüre, wo du getragen wirst. Gleich folgen drei Minuten mit kurzen Hinweisen und stillen Pausen. Du musst nicht besonders atmen. Wenn es unangenehm wird, schau dich im Raum um oder beende die Übung.'),meditation.steps[0],meditation.steps[1]]);
}
