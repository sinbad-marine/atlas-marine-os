/* Source-defined Groq card for the existing Engine Room snapshot.
   This file does not call Groq, Render, or Supabase. */
(function(root){
  'use strict';
  const SOURCE={
    provider:'Groq',
    product:'GroqCloud API',
    endpointHost:'api.groq.com',
    model:'openai/gpt-oss-20b',
    sourceSha256:'6e71d00975fc5d2fb426340d1687a1cfc5b76184ed0ad503366ef43164d02fe2',
    sourceFile:'policy-release-20261008/release/cloud-stage/groq_provider.py',
    sourceReadAt:'2026-10-10T10:22:00Z',
    applicationCharLimit:2000,
    transportTimeoutSeconds:30,
    maxCompletionTokensInSource:1024,
    environmentNameInSource:'RENDER_CLOUD',
    promptVersionInSource:'identity-v1',
    clientIdentifierInSource:'SINBAD-REO/1.0',
    consoleOriginInSource:'https://sinbad-owner-console.onrender.com',
    storageHostInSource:'kcvyftrvteqmabvxfebu.supabase.co',
    secretNames:['GROQ_API_KEY','SESSION_SECRET'],
    evidenceFiles:[
      'policy-release-20261008/release/cloud-stage/groq_provider.py',
      'policy-release-20261008/release/cloud-stage/cloud_reply.py',
      'policy-release-20261008/release/cloud-stage/runtime_identity.py',
      'policy-release-20261008/baseline/cloud-stage/app.py',
      'policy-release-20261008/release/GROQ-OPERATIONS.txt',
      'policy-release-20261008/release/GROQ-RELEASE-MANIFEST.json'
    ]
  };
  const COPY={
    en:{title:'Groq — Cloud model provider',task:'Owner Console cloud consultation reply',flow:'The adapter file says it is not connected to Console or a delivery queue. Hash-matched cloud_reply.py calls provider.answer after an OWNER check and begin_owner_cloud_reply_v1. Live wiring is NOT VERIFIED.',limit:'Application limit: 2000 characters of new plain text; no attachment or history. This is not a provider quota.',timeout:'Source transport timeout: 30 seconds',retry:'No provider retry. HTTP 429 returns QUOTA_WAIT and does not call again. retry-after is clamped from 1 to 86400 seconds; missing or invalid defaults to 60. Unknown outcomes are not called again.',quota:'Provider account plan, quota and usage',flags:'Render enablement flags',health:'Live reachability and health',acceptance:'Owner acceptance of this card'},
    tr:{title:'Groq — Bulut Model Sağlayıcısı',task:'Owner Console bulut danışma yanıtı',flow:'Adaptör dosyası Console’a veya teslim kuyruğuna bağlı olmadığını söyler. Hash’i eşleşen cloud_reply.py, OWNER denetiminden ve begin_owner_cloud_reply_v1 çağrısından sonra provider.answer çağırır. Canlı bağlantı NOT VERIFIED.',limit:'Uygulama sınırı: yeni düz metin, en fazla 2000 karakter; ek ve geçmiş yok. Bu bir sağlayıcı kotası değildir.',timeout:'Kaynak taşıma zaman aşımı: 30 saniye',retry:'Sağlayıcı yeniden denemez. HTTP 429 QUOTA_WAIT döner ve çağrıyı tekrarlamaz. retry-after 1 ile 86400 saniye arasına kısılır; eksik veya geçersizse 60 olur. Bilinmeyen sonuç tekrar çağrılmaz.',quota:'Sağlayıcı hesap planı, kota ve tüketim',flags:'Render etkinlik bayrakları',health:'Canlı erişilebilirlik ve sağlık',acceptance:'Bu kartın Owner kabulü'},
    ru:{title:'Groq — облачный поставщик модели',task:'Облачный консультационный ответ Owner Console',flow:'Файл адаптера говорит, что он не подключён к Console или очереди доставки. Совпадающий по хешу cloud_reply.py вызывает provider.answer после проверки OWNER и begin_owner_cloud_reply_v1. Живое соединение NOT VERIFIED.',limit:'Предел приложения: новый простой текст, не более 2000 знаков; без вложений и истории. Это не квота поставщика.',timeout:'Тайм-аут транспорта в источнике: 30 секунд',retry:'Поставщик не повторяет запрос. HTTP 429 возвращает QUOTA_WAIT и не вызывает снова. retry-after ограничивается от 1 до 86400 секунд; если значения нет или оно неверно, берётся 60. Неизвестный исход не вызывается снова.',quota:'План, квота и расход учётной записи поставщика',flags:'Флаги включения Render',health:'Живая доступность и здоровье',acceptance:'Принятие этой карточки Owner'},
    de:{title:'Groq — Cloud-Modellanbieter',task:'Cloud-Beratungsantwort der Owner Console',flow:'Die Adapterdatei sagt, dass sie nicht mit der Console oder einer Lieferwarteschlange verbunden ist. Die hashgleiche cloud_reply.py ruft provider.answer nach der OWNER-Prüfung und begin_owner_cloud_reply_v1 auf. Live-Verbindung ist NOT VERIFIED.',limit:'Anwendungsgrenze: neuer Klartext, höchstens 2000 Zeichen; keine Anhänge oder Historie. Das ist kein Anbieterkontingent.',timeout:'Transport-Zeitlimit in der Quelle: 30 Sekunden',retry:'Kein Anbieter-Wiederholversuch. HTTP 429 ergibt QUOTA_WAIT und ruft nicht erneut. retry-after wird auf 1 bis 86400 Sekunden begrenzt; fehlt der Wert oder ist er ungültig, gilt 60. Ein unbekanntes Ergebnis wird nicht erneut gerufen.',quota:'Tarif, Kontingent und Verbrauch des Anbieterkontos',flags:'Render-Aktivierungsflags',health:'Live-Erreichbarkeit und Gesundheit',acceptance:'Owner-Annahme dieser Karte'},
    ar:{title:'Groq — مزود النموذج السحابي',task:'رد الاستشارة السحابية لوحدة تحكم المالك',flow:'يقول ملف المهايئ إنه غير متصل بوحدة التحكم أو بطابور تسليم. يستدعي cloud_reply.py المطابق للتجزئة provider.answer بعد فحص OWNER وbegin_owner_cloud_reply_v1. الاتصال الحي NOT VERIFIED.',limit:'حد التطبيق: نص عادي جديد، 2000 حرفًا كحد أقصى؛ بلا مرفقات أو سجل. هذا ليس حصة المزود.',timeout:'مهلة النقل في المصدر: 30 ثانية',retry:'لا يعيد المزود المحاولة. HTTP 429 يعيد QUOTA_WAIT ولا يعيد النداء. يُقيَّد retry-after بين 1 و86400 ثانية؛ وإذا غاب أو كان غير صالح يصبح 60. لا تُعاد النتيجة المجهولة.',quota:'خطة حساب المزود والحصص والاستهلاك',flags:'أعلام تفعيل Render',health:'إمكانية الوصول الحية والصحة',acceptance:'قبول المالك لهذه البطاقة'},
    es:{title:'Groq — Proveedor de modelo en la nube',task:'Respuesta de consulta en la nube de Owner Console',flow:'El archivo del adaptador dice que no está conectado a la Console ni a una cola de entrega. cloud_reply.py, con hash coincidente, llama a provider.answer tras la comprobación OWNER y begin_owner_cloud_reply_v1. La conexión en vivo es NOT VERIFIED.',limit:'Límite de la aplicación: texto plano nuevo, 2000 caracteres como máximo; sin adjuntos ni historial. Esto no es una cuota del proveedor.',timeout:'Tiempo de espera del transporte en la fuente: 30 segundos',retry:'El proveedor no reintenta. HTTP 429 devuelve QUOTA_WAIT y no vuelve a llamar. retry-after se limita de 1 a 86400 segundos; si falta o no es válido, queda en 60. Un resultado desconocido no se vuelve a llamar.',quota:'Plan, cupo y consumo de la cuenta del proveedor',flags:'Indicadores de activación en Render',health:'Alcance en vivo y salud',acceptance:'Aceptación del Owner de esta ficha'},
    fr:{title:'Groq — Fournisseur de modèle cloud',task:'Réponse de consultation cloud de l’Owner Console',flow:'Le fichier de l’adaptateur dit qu’il n’est pas relié à la Console ni à une file de livraison. cloud_reply.py, au hash correspondant, appelle provider.answer après le contrôle OWNER et begin_owner_cloud_reply_v1. La liaison réelle est NOT VERIFIED.',limit:'Limite de l’application : texte brut nouveau, 2000 caractères au plus ; sans pièce jointe ni historique. Ce n’est pas un quota du fournisseur.',timeout:'Délai de transport dans la source : 30 secondes',retry:'Le fournisseur ne réessaie pas. HTTP 429 renvoie QUOTA_WAIT et ne rappelle pas. retry-after est borné de 1 à 86400 secondes ; s’il manque ou est invalide, il vaut 60. Un résultat inconnu n’est pas rappelé.',quota:'Forfait, quota et consommation du compte fournisseur',flags:'Indicateurs d’activation Render',health:'Accessibilité réelle et santé',acceptance:'Acceptation Owner de cette fiche'}
  };
  function codeOf(language){
    const value=String(language||'en').toLowerCase().slice(0,2);
    return COPY[value]?value:'en';
  }
  function fact(label,value,observed){
    return {label,value:String(value),observed:observed===true};
  }
  function engine(language){
    const copy=COPY[codeOf(language)];
    return {
      id:'groq-cloud',
      title:copy.title,
      state:'UNKNOWN',
      task:copy.task,
      taskSource:'source-record',
      evidenceTime:SOURCE.sourceReadAt,
      sources:SOURCE.evidenceFiles,
      facts:[
        fact('provider',SOURCE.provider,true),
        fact('model',SOURCE.model,true),
        fact('prompt version in source',SOURCE.promptVersionInSource,true),
        fact('client identifier in source',SOURCE.clientIdentifierInSource,true),
        fact('endpoint host',SOURCE.endpointHost,true),
        fact('source sha256',SOURCE.sourceSha256,true),
        fact('source read',SOURCE.sourceReadAt,true),
        fact('task',copy.task,true),
        fact('console origin in source',SOURCE.consoleOriginInSource,true),
        fact('environment name in source',SOURCE.environmentNameInSource,true),
        fact('storage host in source',SOURCE.storageHostInSource,true),
        fact('data flow',copy.flow,true),
        fact('call chain','groq_provider.py SHA-256 6e71d00975fc5d2fb426340d1687a1cfc5b76184ed0ad503366ef43164d02fe2 matches the release manifest. Its module comment says the adapter is not connected to Console or a delivery queue. cloud_reply.py SHA-256 c1983f845508a741d5fe3a3bfa2c5d17a8bd41c66a56fb434963481abf3c290f matches the manifest. CloudReply.__init__ builds GroqProvider from GROQ_API_KEY and the flags SINBAD_CLOUD_MODEL_ENABLED, SINBAD_GROQ_FREE_REVIEWED and SINBAD_GROQ_TEXT_APPROVED. CloudReply.submit requires actor role OWNER, calls begin_owner_cloud_reply_v1, returns without another provider call when started is false, then calls provider.answer. runtime_identity.py SHA-256 eced1ca3fd11eb799abb6dafcd344031b6074f2ff60593ef173ef79ea79549eb matches the manifest. release/cloud-stage/app.py SHA-256 a8fa9787cd5848674fd1acab0e744a36ce4d7210fa675c49f42d1fa84be9485f does not match the manifest. baseline/cloud-stage/app.py does. Live flag values and reachability are NOT VERIFIED.',true),
        fact('application limit',copy.limit,true),
        fact('timeout',copy.timeout,true),
        fact('retry',copy.retry,true),
        fact('max completion tokens in source',SOURCE.maxCompletionTokensInSource,true),
        fact('activation gate in source','NOT_ACTIVATED unless enabled, free_plan_reviewed and owner_text_transfer_approved are all true. A local setting does not prove a billing plan.',true),
        fact('submit authority in source','CloudReply.submit requires actor role OWNER. Reads do not generate replies.',true),
        fact('route limits in source','TLS certificate and hostname required. Redirects rejected. No tools, attachments, history export or execution. localCore NOT_PARTICIPATING.',true),
        fact('responsible component','cloud-stage/groq_provider.py, cloud-stage/cloud_reply.py, cloud-stage/runtime_identity.py. Candidate card prepared by GROK. Groq is the provider. No live call.',true),
        fact('named application','Groq is the communication application the Owner named. This card is the GroqCloud provider record. It is not the Owner Console application.',true),
        fact('unverified warning','The warning "ücretsiz tek mesaj 200 karakter" was not found in the hashed adapter files. Its source is NOT VERIFIED. The source application limit that was read is 2000 characters of new plain text.',true),
        fact('operations document','GROQ-OPERATIONS.txt names four flags and says Owner-approved 2026-10-07. That sentence is not a live Render reading.',true),
        fact('archive check','Manifest hash for app.py matches baseline/cloud-stage/app.py. release/cloud-stage/app.py is a different file. Manifest hash for web/app.mjs matches mac-first-job-20261007/app.mjs, not release/web/app.mjs. reo_runtime.py is not in the manifest. The console origin string is in both app.py copies.',true),
        fact('secret names',SOURCE.secretNames.join(', '),true),
        fact(copy.quota,'NOT VERIFIED',false),
        fact(copy.flags,'NOT VERIFIED',false),
        fact(copy.health,'NOT VERIFIED',false),
        fact(copy.acceptance,'NO',true)
      ],
      notConnected:['live service','account plan','provider quota','current usage','health']
    };
  }
  const api={source:SOURCE,engine,codeOf};
  root.SinbadGroqRecord=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
