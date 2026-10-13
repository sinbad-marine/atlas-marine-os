/* Read identity, task, boundary, connection and evidence time from an Engine Room record.
   Classification is not a health measurement. Aborted probes and UNKNOWN stay unverified or unreachable.
   A different measurement time and snapshot time is not, by itself, a conflict.
   This file does not call a model, Bridge, or a provider. */
(function(root){
  'use strict';
  const OBSERVED=['RUNNING','IDLE','OFFLINE','DEGRADED','FAULT'];
  function evidenceClock(evidenceTime,options){
    const opts=options||{};
    const evidenceMs=Date.parse(evidenceTime||'');
    const nowMs=Number.isFinite(opts.nowMs)?opts.nowMs:Date.parse(opts.now||'');
    return {evidenceMs,nowMs};
  }
  function measurementClock(engine,snapshot,options){
    const direct=typeof engine?.evidenceTime==='string'?engine.evidenceTime.trim():'';
    const separated=Boolean(snapshot&&(snapshot.compiledAt||snapshot.receivedAt));
    let evidenceTime=null;
    let freshnessLimit=null;
    if(direct)evidenceTime=direct;
    else if(separated)freshnessLimit='SOURCE_MEASUREMENT_TIME_ABSENT';
    else if(typeof snapshot?.observedAt==='string'&&snapshot.observedAt.trim())evidenceTime=snapshot.observedAt;
    const clock=evidenceClock(evidenceTime,options);
    if(evidenceTime&&!Number.isFinite(clock.evidenceMs))freshnessLimit='SOURCE_MEASUREMENT_TIME_INVALID';
    else if(Number.isFinite(clock.evidenceMs)&&Number.isFinite(clock.nowMs)&&clock.evidenceMs>clock.nowMs)freshnessLimit='SOURCE_MEASUREMENT_TIME_FUTURE';
    return {evidenceTime,freshnessLimit,...clock};
  }
  function readEngineRoomComponent(engine,snapshot,options){
    const opts=options||{};
    const measured=measurementClock(engine,snapshot,opts);
    const evidenceTime=measured.evidenceTime;
    const freshnessLimit=measured.freshnessLimit||null;
    const identity=engine?.id&&engine?.title?{id:String(engine.id),title:String(engine.title)}:null;
    const task=typeof engine?.task==='string'&&engine.task.trim()?engine.task.trim():null;
    const boundary=Array.isArray(engine?.notConnected)?engine.notConnected.slice():null;
    const connection=Array.isArray(engine?.sources)?engine.sources.map(item=>String(item)):[];
    const state=String(engine?.state||'');
    const {evidenceMs,nowMs}=measured;
    const maxAgeMs=Number.isFinite(opts.maxAgeMs)?opts.maxAgeMs:15*60*1000;
    const simulated=engine?.simulated===true||snapshot?.simulated===true||engine?.session==='simulated';
    const ownAbort=engine?.probeAborted===true||connection.some(item=>item==='aborted-probe');
    const snapshotAbort=snapshot?.probeAborted===true&&engine?.taskSource!=='source-record';
    const aborted=ownAbort||snapshotAbort;
    const conflictFact=(engine?.facts||[]).some(fact=>fact&&String(fact.label||'').toLowerCase()==='conflict'&&String(fact.value||'').trim()&&!/^(false|none|no)$/i.test(String(fact.value).trim()));
    const observedFact=(engine?.facts||[]).find(fact=>fact&&String(fact.label||'').toLowerCase()==='observed state');
    const observedValue=observedFact?String(observedFact.value||''):'';
    const stateConflict=OBSERVED.includes(state)&&OBSERVED.includes(observedValue)&&observedValue!==state;
    const conflicting=engine?.conflicting===true||snapshot?.conflicting===true||conflictFact||stateConflict;
    const freshnessKnown=Number.isFinite(evidenceMs)&&Number.isFinite(nowMs);
    const future=freshnessKnown&&evidenceMs>nowMs;
    const old=freshnessKnown&&!future&&nowMs-evidenceMs>maxAgeMs;
    const unreachable=aborted||state==='UNAVAILABLE'||connection.length===0;
    let recordClass='unverified';
    let freshness='invalid';
    if(!freshnessKnown)freshness='invalid';
    else if(future)freshness='future';
    else if(old)freshness='old';
    else freshness='within-window';
    if(simulated)recordClass='simulated';
    else if(conflicting)recordClass='conflicting';
    else if(unreachable)recordClass='unreachable';
    else if(!freshnessKnown||future)recordClass='unverified';
    else if(old)recordClass='old';
    else if(state==='UNKNOWN'||!identity||!boundary)recordClass='unverified';
    else if(OBSERVED.includes(state))recordClass='current';
    return {
      identity,
      task,
      taskSource:task?(engine.taskSource||'record'):null,
      boundary,
      connection,
      evidenceTime:evidenceTime||null,
      freshnessLimit,
      state,
      recordClass,
      freshness,
      health:'NOT_A_HEALTH_MEASUREMENT',
      liveHealth:false
    };
  }
  function annotateEngineRoomSnapshot(snapshot,options){
    if(!snapshot||!Array.isArray(snapshot.engines))return snapshot;
    snapshot.components=snapshot.engines.map(engine=>readEngineRoomComponent(engine,snapshot,options));
    snapshot.health='NOT_A_HEALTH_MEASUREMENT';
    return snapshot;
  }
  function composeEngineRoomSnapshot(snapshot,extraEngines,options){
    if(!snapshot||!Array.isArray(snapshot.engines))return snapshot;
    for(const engine of extraEngines||[]){
      if(engine&&engine.id&&!snapshot.engines.some(item=>item&&item.id===engine.id))snapshot.engines.push(engine);
    }
    return annotateEngineRoomSnapshot(snapshot,options);
  }
  const presentationCopy={
  "en": {
    "sourceFiles": "Source files",
    "signin": "Authorized sign-in required",
    "restricted": "Observation permission required",
    "idle": "Observation not requested. Use Refresh to request authorized read-only data.",
    "checking": "Requesting observed data…",
    "unavailable": "Data unavailable",
    "unknown": "Not measured",
    "old": "Old record",
    "fault": "Source reports a fault",
    "offline": "Source reports offline",
    "degraded": "Source reports a limitation",
    "running": "Source reports running",
    "idleState": "Source reports idle",
    "simulated": "Test record",
    "conflicting": "Conflicting record",
    "noTime": "No measurement time supplied",
    "invalidTime": "Source time cannot be verified",
    "measuredAt": "Source measurement",
    "recordAt": "Source record read",
    "source": "Source",
    "noSource": "No source response",
    "details": "Technical details",
    "health": "Live health has not been verified.",
    "refresh": "Refresh observed data",
    "readOnly": "Read only",
    "description": "Source records are shown separately from health measurements. Missing data does not mean a fault.",
    "close": "Close"
  },
  "tr": {
    "sourceFiles": "Kaynak dosyaları",
    "signin": "Yetkili giriş gerekli",
    "restricted": "Gözlem yetkisi gerekli",
    "idle": "Gözlem istenmedi. İzinli salt okunur veriyi istemek için Yenile’ye basın.",
    "checking": "Gözlem verisi isteniyor…",
    "unavailable": "Veri alınamadı",
    "unknown": "Ölçüm yok",
    "old": "Eski kayıt",
    "fault": "Kaynak arıza bildirdi",
    "offline": "Kaynak çevrimdışı bildirdi",
    "degraded": "Kaynak kısıt bildirdi",
    "running": "Kaynak çalışıyor bildirdi",
    "idleState": "Kaynak boşta bildirdi",
    "simulated": "Deneme kaydı",
    "conflicting": "Çelişkili kayıt",
    "noTime": "Ölçüm zamanı bildirilmedi",
    "invalidTime": "Kaynak zamanı doğrulanamadı",
    "measuredAt": "Kaynağın ölçüm zamanı",
    "recordAt": "Kaynak kaydının okunma zamanı",
    "source": "Kaynak",
    "noSource": "Kaynak yanıtı yok",
    "details": "Teknik ayrıntılar",
    "health": "Canlı sağlık doğrulanmadı.",
    "refresh": "Gözlem verisini yenile",
    "readOnly": "Salt okunur",
    "description": "Kaynak kayıtları sağlık ölçümünden ayrı gösterilir. Veri eksikliği arıza anlamına gelmez.",
    "close": "Kapat"
  },
  "ru": {
    "sourceFiles": "Файлы источника",
    "signin": "Требуется авторизованный вход",
    "restricted": "Требуется разрешение на наблюдение",
    "idle": "Наблюдение не запрошено. Нажмите «Обновить» для разрешённого чтения.",
    "checking": "Запрашиваются данные…",
    "unavailable": "Данные не получены",
    "unknown": "Нет измерения",
    "old": "Старая запись",
    "fault": "Источник сообщает о неисправности",
    "offline": "Источник сообщает об отключении",
    "degraded": "Источник сообщает об ограничении",
    "running": "Источник сообщает о работе",
    "idleState": "Источник сообщает о простое",
    "simulated": "Тестовая запись",
    "conflicting": "Противоречивая запись",
    "noTime": "Время измерения не указано",
    "invalidTime": "Время источника не подтверждено",
    "measuredAt": "Измерение источника",
    "recordAt": "Время чтения записи",
    "source": "Источник",
    "noSource": "Нет ответа источника",
    "details": "Технические сведения",
    "health": "Текущее состояние не проверено.",
    "refresh": "Обновить данные наблюдения",
    "readOnly": "Только чтение",
    "description": "Записи источника отделены от измерений состояния. Отсутствие данных не означает неисправность.",
    "close": "Закрыть"
  },
  "de": {
    "sourceFiles": "Quelldateien",
    "signin": "Autorisierte Anmeldung erforderlich",
    "restricted": "Beobachtungsberechtigung erforderlich",
    "idle": "Beobachtung nicht angefordert. Mit Aktualisieren erlaubte Daten schreibgeschützt abrufen.",
    "checking": "Beobachtungsdaten werden angefordert…",
    "unavailable": "Keine Daten erhalten",
    "unknown": "Keine Messung",
    "old": "Alter Eintrag",
    "fault": "Quelle meldet einen Fehler",
    "offline": "Quelle meldet offline",
    "degraded": "Quelle meldet Einschränkung",
    "running": "Quelle meldet Betrieb",
    "idleState": "Quelle meldet Leerlauf",
    "simulated": "Testeintrag",
    "conflicting": "Widersprüchlicher Eintrag",
    "noTime": "Keine Messzeit angegeben",
    "invalidTime": "Quellzeit nicht bestätigt",
    "measuredAt": "Messzeit der Quelle",
    "recordAt": "Quelleneintrag gelesen",
    "source": "Quelle",
    "noSource": "Keine Antwort der Quelle",
    "details": "Technische Details",
    "health": "Live-Zustand nicht bestätigt.",
    "refresh": "Beobachtungsdaten aktualisieren",
    "readOnly": "Schreibgeschützt",
    "description": "Quelleneinträge sind von Zustandsmessungen getrennt. Fehlende Daten bedeuten keinen Fehler.",
    "close": "Schließen"
  },
  "ar": {
    "sourceFiles": "ملفات المصدر",
    "signin": "يلزم تسجيل دخول مصرح به",
    "restricted": "يلزم إذن المراقبة",
    "idle": "لم تُطلب المراقبة. اضغط تحديث لطلب البيانات المسموح بقراءتها.",
    "checking": "جارٍ طلب بيانات المراقبة…",
    "unavailable": "تعذر الحصول على البيانات",
    "unknown": "لا يوجد قياس",
    "old": "سجل قديم",
    "fault": "المصدر يبلغ عن عطل",
    "offline": "المصدر يبلغ عن عدم الاتصال",
    "degraded": "المصدر يبلغ عن قيد",
    "running": "المصدر يبلغ عن التشغيل",
    "idleState": "المصدر يبلغ عن الخمول",
    "simulated": "سجل تجريبي",
    "conflicting": "سجل متعارض",
    "noTime": "لم يُذكر وقت القياس",
    "invalidTime": "لم يتم التحقق من وقت المصدر",
    "measuredAt": "وقت قياس المصدر",
    "recordAt": "وقت قراءة سجل المصدر",
    "source": "المصدر",
    "noSource": "لا توجد استجابة من المصدر",
    "details": "التفاصيل التقنية",
    "health": "لم يتم التحقق من الحالة الحية.",
    "refresh": "تحديث بيانات المراقبة",
    "readOnly": "للقراءة فقط",
    "description": "تُعرض سجلات المصدر منفصلة عن قياسات الحالة. غياب البيانات لا يعني وجود عطل.",
    "close": "إغلاق"
  },
  "es": {
    "sourceFiles": "Archivos fuente",
    "signin": "Se requiere acceso autorizado",
    "restricted": "Se requiere permiso de observación",
    "idle": "Observación no solicitada. Pulse Actualizar para solicitar lectura autorizada.",
    "checking": "Solicitando datos observados…",
    "unavailable": "Datos no disponibles",
    "unknown": "Sin medición",
    "old": "Registro antiguo",
    "fault": "La fuente informa de un fallo",
    "offline": "La fuente informa de desconexión",
    "degraded": "La fuente informa de una limitación",
    "running": "La fuente informa de actividad",
    "idleState": "La fuente informa de reposo",
    "simulated": "Registro de prueba",
    "conflicting": "Registro contradictorio",
    "noTime": "Sin hora de medición",
    "invalidTime": "Hora de origen sin verificar",
    "measuredAt": "Medición de origen",
    "recordAt": "Lectura del registro de origen",
    "source": "Fuente",
    "noSource": "Sin respuesta de la fuente",
    "details": "Detalles técnicos",
    "health": "Estado en vivo sin verificar.",
    "refresh": "Actualizar datos observados",
    "readOnly": "Solo lectura",
    "description": "Los registros se separan de las mediciones de estado. La falta de datos no indica un fallo.",
    "close": "Cerrar"
  },
  "fr": {
    "sourceFiles": "Fichiers source",
    "signin": "Connexion autorisée requise",
    "restricted": "Autorisation d’observation requise",
    "idle": "Observation non demandée. Actualisez pour demander une lecture autorisée.",
    "checking": "Demande des données observées…",
    "unavailable": "Données indisponibles",
    "unknown": "Aucune mesure",
    "old": "Ancien relevé",
    "fault": "La source signale une panne",
    "offline": "La source signale une déconnexion",
    "degraded": "La source signale une limitation",
    "running": "La source signale une activité",
    "idleState": "La source signale une veille",
    "simulated": "Relevé de test",
    "conflicting": "Relevé contradictoire",
    "noTime": "Heure de mesure non fournie",
    "invalidTime": "Heure de la source non vérifiée",
    "measuredAt": "Mesure de la source",
    "recordAt": "Lecture du relevé source",
    "source": "Source",
    "noSource": "Aucune réponse de la source",
    "details": "Détails techniques",
    "health": "État en direct non vérifié.",
    "refresh": "Actualiser les données observées",
    "readOnly": "Lecture seule",
    "description": "Les relevés sont distincts des mesures d’état. L’absence de données ne signifie pas une panne.",
    "close": "Fermer"
  }
};
  function copy(language){return presentationCopy[String(language||'en').slice(0,2)]||presentationCopy.en;}
  function present(engine,snapshot,language,options){
    const words=copy(language),record=readEngineRoomComponent(engine,snapshot,options);
    let kind='unknown',tone='neutral';
    if(record.recordClass==='simulated')kind='simulated';
    else if(record.recordClass==='conflicting')kind='conflicting';
    else if(record.freshness==='old'){kind='old';tone='caution';}
    else if(record.recordClass==='unreachable')kind='unavailable';
    else if(record.recordClass==='current'&&engine.taskSource!=='source-record'){
      kind=({FAULT:'fault',OFFLINE:'offline',DEGRADED:'degraded',RUNNING:'running',IDLE:'idleState'})[record.state]||'unknown';
      if(kind==='fault')tone='fault';
      else if(kind==='offline'||kind==='degraded')tone='caution';
    }
    // Local compilation time never substitutes for a source measurement.
    const validTime=record.evidenceTime&&!record.freshnessLimit;
    let time=words.noTime;
    if(record.evidenceTime&&!validTime)time=words.invalidTime;
    else if(validTime){
      const date=new Date(record.evidenceTime);
      time=`${engine.taskSource==='source-record'?words.recordAt:words.measuredAt}: ${new Intl.DateTimeFormat(language||'en-US',{dateStyle:'medium',timeStyle:'medium',timeZone:'UTC'}).format(date)} UTC`;
    }
    return {kind,tone,label:words[kind],time,record};
  }
  root.SinbadEngineRoomRecord={read:readEngineRoomComponent,annotate:annotateEngineRoomSnapshot,compose:composeEngineRoomSnapshot,copy,present};
})(typeof globalThis!=='undefined'?globalThis:this);
