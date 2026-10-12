/* Home presentation and read-only refresh. Auth remains owned by app.js. */
(function(){
  'use strict';
  const favorites=window.SinbadFavorites,catalog=window.SinbadFavoritesCatalog;
  const codes=['en','tr','ru','de','ar','es','fr'];
  const code=()=>{const value=String(typeof appLanguage==='string'?appLanguage:'en').toLowerCase().slice(0,2);return codes.includes(value)?value:'en';};
  const words={
    en:{favorites:'Favorites',personal:'YOUR SHORTCUTS',manage:'Your favorites',close:'Close',refresh:'Refresh',checking:'Refreshing…',never:'Refresh available data',ready:'Cloud summary refreshed',error:'Refresh failed. Previous values may be stale.',unavailable:'Sign in and select a connected workspace to refresh cloud data.',restricted:'This account cannot read the private document summary.',stale:'Account or workspace changed. Refresh again.',ask:'Ask SINBAD',quick:'Quick actions',tools:'All available tools',settings:'Settings',account:'Account & Password',explore:'Explore',local:'Local',pc:'Console',cloud:'Cloud',sync:'Sync',agents:'Agents',action:'Action',refreshed:'REFRESHED',unknown:'NOT VERIFIED',files:'Files',publications:'Publications',charts:'Charts',storage:'Storage',ui:'UI READY',home:'Home',consoleEntry:'Owner Console',communicationEntry:'Groq',communicationEntryLabel:'Groq communication application. Target NOT VERIFIED. Not the GroqCloud provider card.'},
    tr:{favorites:'Favoriler',personal:'KISAYOLLARINIZ',manage:'Favorileriniz',close:'Kapat',refresh:'Yenile',checking:'Yenileniyor…',never:'Mevcut verileri yenileyin',ready:'Bulut özeti yenilendi',error:'Yenileme başarısız. Önceki değerler güncel olmayabilir.',unavailable:'Bulut verilerini yenilemek için giriş yapıp bağlı bir çalışma alanı seçin.',restricted:'Bu hesap özel belge özetini okuyamıyor.',stale:'Hesap veya çalışma alanı değişti. Yeniden yenileyin.',ask:'SINBAD’a sor',quick:'Hızlı işlemler',tools:'Tüm mevcut araçlar',settings:'Ayarlar',account:'Hesap ve Parola',explore:'Keşfet',local:'Yerel',pc:'Konsol',cloud:'Bulut',sync:'Eşitleme',agents:'Ajanlar',action:'Eylem',refreshed:'YENİLENDİ',unknown:'DOĞRULANMADI',files:'Dosyalar',publications:'Yayınlar',charts:'Haritalar',storage:'Depolama',ui:'ARAYÜZ HAZIR',home:'Ana sayfa',consoleEntry:'Owner Console',communicationEntry:'Groq',communicationEntryLabel:'Owner’ın adlandırdığı Groq haberleşme uygulaması. Hedef NOT VERIFIED. Bu, GroqCloud sağlayıcı kartı değildir.'},
    ru:{favorites:'Избранное',personal:'ВАШИ ЯРЛЫКИ',manage:'Ваше избранное',close:'Закрыть',refresh:'Обновить',checking:'Обновление…',never:'Обновите доступные данные',ready:'Облачная сводка обновлена',error:'Обновление не выполнено. Прежние значения могут быть устаревшими.',unavailable:'Чтобы обновить облачные данные, войдите и выберите подключённое рабочее пространство.',restricted:'Эта учётная запись не может читать закрытую сводку документов.',stale:'Учётная запись или пространство изменились. Обновите снова.',ask:'Спросить SINBAD',quick:'Быстрые действия',tools:'Все доступные инструменты',settings:'Настройки',account:'Учётная запись и пароль',explore:'Открыть',local:'Локально',pc:'Консоль',cloud:'Облако',sync:'Синхронизация',agents:'Агенты',action:'Действие',refreshed:'ОБНОВЛЕНО',unknown:'НЕ ПРОВЕРЕНО',files:'Файлы',publications:'Издания',charts:'Карты',storage:'Хранилище',ui:'ИНТЕРФЕЙС ГОТОВ',home:'Главная',consoleEntry:'Owner Console',communicationEntry:'Groq',communicationEntryLabel:'Приложение связи Groq, названное Owner. Цель NOT VERIFIED. Это не карточка поставщика GroqCloud.'},
    de:{favorites:'Favoriten',personal:'IHRE KÜRZEL',manage:'Ihre Favoriten',close:'Schließen',refresh:'Aktualisieren',checking:'Wird aktualisiert…',never:'Verfügbare Daten aktualisieren',ready:'Cloud-Zusammenfassung aktualisiert',error:'Aktualisierung fehlgeschlagen. Vorherige Werte können veraltet sein.',unavailable:'Melden Sie sich an und wählen Sie einen verbundenen Arbeitsbereich, um Cloud-Daten zu aktualisieren.',restricted:'Dieses Konto kann die private Dokumentzusammenfassung nicht lesen.',stale:'Konto oder Arbeitsbereich hat sich geändert. Erneut aktualisieren.',ask:'SINBAD fragen',quick:'Schnellaktionen',tools:'Alle verfügbaren Werkzeuge',settings:'Einstellungen',account:'Konto und Passwort',explore:'Öffnen',local:'Lokal',pc:'Konsole',cloud:'Cloud',sync:'Abgleich',agents:'Agenten',action:'Aktion',refreshed:'AKTUALISIERT',unknown:'NICHT VERIFIZIERT',files:'Dateien',publications:'Publikationen',charts:'Karten',storage:'Speicher',ui:'OBERFLÄCHE BEREIT',home:'Startseite',consoleEntry:'Owner Console',communicationEntry:'Groq',communicationEntryLabel:'Vom Owner benannte Groq-Kommunikationsanwendung. Ziel NOT VERIFIED. Dies ist nicht die GroqCloud-Anbieterkarte.'},
    ar:{favorites:'المفضلة',personal:'اختصاراتك',manage:'مفضلتك',close:'إغلاق',refresh:'تحديث',checking:'جارٍ التحديث…',never:'حدّث البيانات المتاحة',ready:'تم تحديث ملخص السحابة',error:'تعذر التحديث. قد تكون القيم السابقة غير حديثة.',unavailable:'لتحديث بيانات السحابة، سجّل الدخول واختر مساحة عمل متصلة.',restricted:'لا يمكن لهذا الحساب قراءة ملخص الوثائق الخاصة.',stale:'تغيّر الحساب أو مساحة العمل. حدّث مرة أخرى.',ask:'اسأل سندباد',quick:'إجراءات سريعة',tools:'كل الأدوات المتاحة',settings:'الإعدادات',account:'الحساب وكلمة المرور',explore:'استكشف',local:'محلي',pc:'وحدة التحكم',cloud:'السحابة',sync:'المزامنة',agents:'الوكلاء',action:'إجراء',refreshed:'تم التحديث',unknown:'غير متحقق',files:'ملفات',publications:'منشورات',charts:'خرائط',storage:'التخزين',ui:'الواجهة جاهزة',home:'الرئيسية',consoleEntry:'وحدة تحكم المالك',communicationEntry:'Groq',communicationEntryLabel:'تطبيق Groq للاتصال الذي سمّاه المالك. الوجهة NOT VERIFIED. هذه ليست بطاقة مزود GroqCloud.'},
    es:{favorites:'Favoritos',personal:'SUS ACCESOS',manage:'Sus favoritos',close:'Cerrar',refresh:'Actualizar',checking:'Actualizando…',never:'Actualice los datos disponibles',ready:'Resumen de la nube actualizado',error:'La actualización falló. Los valores anteriores pueden estar desactualizados.',unavailable:'Inicie sesión y elija un espacio conectado para actualizar los datos de la nube.',restricted:'Esta cuenta no puede leer el resumen privado de documentos.',stale:'La cuenta o el espacio cambiaron. Actualice de nuevo.',ask:'Preguntar a SINBAD',quick:'Acciones rápidas',tools:'Todas las herramientas disponibles',settings:'Ajustes',account:'Cuenta y contraseña',explore:'Explorar',local:'Local',pc:'Consola',cloud:'Nube',sync:'Sincronización',agents:'Agentes',action:'Acción',refreshed:'ACTUALIZADO',unknown:'NO VERIFICADO',files:'Archivos',publications:'Publicaciones',charts:'Cartas',storage:'Almacenamiento',ui:'INTERFAZ LISTA',home:'Inicio',consoleEntry:'Consola del Owner',communicationEntry:'Groq',communicationEntryLabel:'Aplicación de comunicación Groq nombrada por el Owner. Destino NOT VERIFIED. No es la ficha del proveedor GroqCloud.'},
    fr:{favorites:'Favoris',personal:'VOS RACCOURCIS',manage:'Vos favoris',close:'Fermer',refresh:'Actualiser',checking:'Actualisation…',never:'Actualisez les données disponibles',ready:'Résumé cloud actualisé',error:'L’actualisation a échoué. Les valeurs précédentes peuvent être périmées.',unavailable:'Connectez-vous et choisissez un espace relié pour actualiser les données cloud.',restricted:'Ce compte ne peut pas lire le résumé privé des documents.',stale:'Le compte ou l’espace a changé. Actualisez de nouveau.',ask:'Demander à SINBAD',quick:'Actions rapides',tools:'Tous les outils disponibles',settings:'Réglages',account:'Compte et mot de passe',explore:'Explorer',local:'Local',pc:'Console',cloud:'Cloud',sync:'Synchronisation',agents:'Agents',action:'Action',refreshed:'ACTUALISÉ',unknown:'NON VÉRIFIÉ',files:'Fichiers',publications:'Publications',charts:'Cartes',storage:'Stockage',ui:'INTERFACE PRÊTE',home:'Accueil',consoleEntry:'Console Owner',communicationEntry:'Groq',communicationEntryLabel:'Application de communication Groq nommée par l’Owner. Cible NOT VERIFIED. Ce n’est pas la fiche du fournisseur GroqCloud.'}
  };
  const copies={
    'yacht-operations':{
      en:['01 · OPERATIONS','Fleet · Crew · Logbook · Media'],
      tr:['01 · OPERASYONLAR','Filo · Mürettebat · Seyir Defteri · Medya'],
      ru:['01 · ОПЕРАЦИИ','Флот · Экипаж · Журнал · Медиа'],
      de:['01 · BETRIEB','Flotte · Besatzung · Tagebuch · Medien'],
      ar:['01 · العمليات','الأسطول · الطاقم · السجل · الوسائط'],
      es:['01 · OPERACIONES','Flota · Tripulación · Diario · Medios'],
      fr:['01 · OPÉRATIONS','Flotte · Équipage · Journal · Médias']
    },
    'voyage-navigation':{
      en:['02 · VOYAGE','Routes · Charts · Weather · Pilotage'],
      tr:['02 · SEYİR','Rotalar · Haritalar · Hava · Kılavuzluk'],
      ru:['02 · РЕЙС','Маршруты · Карты · Погода · Лоцманская проводка'],
      de:['02 · REISE','Routen · Karten · Wetter · Lotsenwesen'],
      ar:['02 · الرحلة','مسارات · خرائط · طقس · إرشاد'],
      es:['02 · TRAVESÍA','Rutas · Cartas · Tiempo · Practicaje'],
      fr:['02 · TRAVERSÉE','Routes · Cartes · Météo · Pilotage']
    },
    'page:academy.html':{
      en:['03 · KNOWLEDGE','Learn · Train · Certify · Grow'],
      tr:['03 · BİLGİ','Öğren · Eğitim Al · Sertifikalan · Geliş'],
      ru:['03 · ЗНАНИЯ','Учиться · Тренироваться · Сертификация · Рост'],
      de:['03 · WISSEN','Lernen · Trainieren · Zertifizieren · Wachsen'],
      ar:['03 · المعرفة','تعلّم · تدرّب · اعتمد · تطوّر'],
      es:['03 · CONOCIMIENTO','Aprender · Entrenar · Certificar · Crecer'],
      fr:['03 · SAVOIR','Apprendre · S’entraîner · Certifier · Progresser']
    },
    'documents-compliance':{
      en:['04 · ASSURANCE','ISM · ISPS · MLC · Audits'],
      tr:['04 · GÜVENCE','ISM · ISPS · MLC · Denetimler'],
      ru:['04 · ОБЕСПЕЧЕНИЕ','ISM · ISPS · MLC · Проверки'],
      de:['04 · NACHWEIS','ISM · ISPS · MLC · Audits und Nachweise'],
      ar:['04 · الضمان','ISM · ISPS · MLC · عمليات التدقيق'],
      es:['04 · GARANTÍA','ISM · ISPS · MLC · Auditorías'],
      fr:['04 · ASSURANCE','ISM · ISPS · MLC · Audits']
    },
    'technical-systems':{
      en:['05 · SYSTEMS','Support · Maintenance · Cloud · ARGOS'],
      tr:['05 · SİSTEMLER','Destek · Bakım · Bulut · ARGOS'],
      ru:['05 · СИСТЕМЫ','Поддержка · Обслуживание · Облако · ARGOS'],
      de:['05 · SYSTEME','Support · Wartung · Cloud · ARGOS'],
      ar:['05 · الأنظمة','الدعم · الصيانة · السحابة · ARGOS'],
      es:['05 · SISTEMAS','Soporte · Mantenimiento · Nube · ARGOS'],
      fr:['05 · SYSTÈMES','Assistance · Maintenance · Cloud · ARGOS']
    },
    'sinbad-ai':{
      en:['06 · INTELLIGENCE','Captain Sinbad · Agents · Intelligence'],
      tr:['06 · ZEKÂ','Kaptan Sinbad · Ajanlar · Zekâ'],
      ru:['06 · ИНТЕЛЛЕКТ','Капитан Синбад · Агенты · Аналитика'],
      de:['06 · INTELLIGENZ','Kapitän Sinbad · Agenten · Auswertung'],
      ar:['06 · الذكاء','القبطان سندباد · الوكلاء · التحليل'],
      es:['06 · INTELIGENCIA','Capitán Sinbad · Agentes · Inteligencia'],
      fr:['06 · INTELLIGENCE','Capitaine Sinbad · Agents · Renseignement']
    },
    store:{
      en:['07 · SUPPLY','Equipment · Spares · Provisions'],
      tr:['07 · TEDARİK','Ekipman · Yedek Parçalar · Kumanya'],
      ru:['07 · СНАБЖЕНИЕ','Оборудование · Запчасти · Провизия'],
      de:['07 · VERSORGUNG','Ausrüstung · Ersatzteile · Proviant'],
      ar:['07 · الإمداد','معدات · قطع غيار · تموين'],
      es:['07 · SUMINISTRO','Equipo · Repuestos · Provisiones'],
      fr:['07 · APPROVISIONNEMENT','Équipement · Rechanges · Vivres']
    }
  };
  let localState='unknown',localCheckedAt=null,localObservation='';
  let state='never',attemptedAt=null,verifiedAt=null,counts=null,inFlight=null,accountScope=null,generation=0;
  const t=key=>words[code()][key]||words.en[key]||key;
  function text(selector,value){document.querySelectorAll(selector).forEach(el=>{if(el.textContent!==value)el.textContent=value;});}
  function renderObserved(){
    setConsoleStatus('pc','ready',t('ui'));
    setConsoleStatus('cloud',state==='ready'?'ready':state==='error'?'offline':'unknown',state==='ready'?t('refreshed'):t('unknown'));
    setConsoleStatus('local',localState,t('unknown'));
    const localNode=document.querySelector('[data-console-status="local"]');if(localNode)localNode.removeAttribute('title');
    ['sync','agents','action'].forEach(name=>setConsoleStatus(name,'unknown',t('unknown')));
    const status=document.getElementById('homeRefreshResult');
    if(status){
      status.textContent=state==='never'?'':t(state);
      status.dataset.state=state;
      status.hidden=state==='never';
      if(attemptedAt)status.dataset.attemptedAt=attemptedAt.toISOString();
      if(verifiedAt)status.dataset.verifiedAt=verifiedAt.toISOString();else delete status.dataset.verifiedAt;
      if(localCheckedAt)status.dataset.localCheckedAt=localCheckedAt.toISOString();
      if(localObservation)status.dataset.localObservation=localObservation;
    }
    const liveData=document.querySelector('.home-live-data');if(liveData)liveData.hidden=state==='never'&&!counts;
    const summary=document.getElementById('homeCloudSummary');if(summary)summary.textContent=state==='ready'&&counts?`${t('files')}: ${counts.files} · ${t('publications')}: ${counts.publications} · ${t('charts')}: ${counts.charts} · ${t('storage')}: ${counts.storage}`:'';
  }
  function translate(){
    favorites.setLanguage(appLanguage);
    const lang=code();
    document.querySelectorAll('.console-domain-card').forEach(card=>{
      const id=card.dataset.open||'page:academy.html';
      const item=catalog[id.startsWith('page:')?id:`workspace:${id}`];
      const copy=copies[id]?.[lang];
      const name=item?.[lang];
      if(!item||!copy||!name)return;
      card.querySelector('h3').textContent=name;
      card.querySelector('p').textContent=copy[1];
      card.querySelector(':scope > span').textContent=copy[0];
      card.querySelector('a').textContent=t('explore');
      card.setAttribute('aria-label',name);
    });
    text('#consoleFavoritesPanel header h3,#consoleFavoritesDialog h2',t('favorites'));
    text('#consoleFavoritesPanel header span,#consoleFavoritesDialog header span',t('personal'));
    document.querySelectorAll('[data-console-favorites]').forEach(button=>{const span=button.querySelector('span');if(span)span.textContent=t('favorites');else button.textContent=t('favorites');button.setAttribute('aria-label',t('favorites'));});
    text('#consoleFavoritesDialog button[value="done"]',t('close'));
    document.querySelector('#consoleFavoritesDialog button[value="cancel"]')?.setAttribute('aria-label',t('close'));
    text('#consoleStatusRefresh .home-refresh-label,#homeCanonicalRefresh',`↻ ${t('refresh')}`);
    const statusRefresh=document.getElementById('consoleStatusRefresh');
    if(statusRefresh&&!statusRefresh.querySelector('.home-refresh-label'))statusRefresh.textContent=`↻ ${t('refresh')}`;
    document.getElementById('homeCanonicalRefresh')?.setAttribute('aria-label',t('refresh'));
    text('.home-hotspot-settings',t('settings'));
    document.querySelector('.home-hotspot-settings')?.setAttribute('aria-label',t('settings'));
    text('.home-hotspot-ask,.console-dock-actions [data-open="sinbad"]',t('ask'));
    document.querySelectorAll('.console-tool-grid [data-open],.hero-action-menu [data-open]').forEach(button=>{const name=catalog[`workspace:${button.dataset.open}`]?.[lang];if(name)button.textContent=name;});
    text('.console-all-tools>summary',t('tools'));
    const menuSummary=document.querySelector('.hero-action-menu>summary');
    if(menuSummary){const icon=document.createElement('span');icon.setAttribute('aria-hidden','true');icon.textContent='☰';menuSummary.replaceChildren(icon,document.createTextNode(` ${t('quick')}`));menuSummary.setAttribute('aria-label',t('quick'));}
    document.getElementById('homeCanonicalMenu')?.setAttribute('aria-label',t('quick'));
    text('#openAccountPassword',t('account'));
    document.querySelectorAll('.console-primary-nav [data-open]').forEach(button=>{const name=catalog[`workspace:${button.dataset.open}`]?.[lang];const span=button.querySelector('span');if(name&&span)span.textContent=name;});
    const academyNav=document.querySelector('.console-primary-nav [data-open-sinbad-academy] span');
    if(academyNav&&catalog['page:academy.html']?.[lang])academyNav.textContent=catalog['page:academy.html'][lang];
    const homeSpan=document.querySelector('[data-console-home] span');if(homeSpan)homeSpan.textContent=t('home');
    const consoleEntry=document.getElementById('ownerConsoleEntry');if(consoleEntry)consoleEntry.textContent=t('consoleEntry');
    const communicationEntry=document.getElementById('communicationAppEntry');if(communicationEntry){communicationEntry.textContent=t('communicationEntry');communicationEntry.title=t('communicationEntryLabel');communicationEntry.setAttribute('aria-label',t('communicationEntryLabel'));}
    document.querySelectorAll('[data-console-status]').forEach(el=>{const name=el.dataset.consoleStatus,b=el.querySelector('b');if(b&&words[lang][name])b.textContent=t(name);});
    renderObserved();
  }
  function syncAccount(){
    const user=cloudSession?.user,ready=Boolean(user&&!needsInviteSetup(user)&&cloudClient),project=getCloudConfig().url;
    const next=ready?`${project}|${user.id}|${selectedWorkspaceId}`:'';
    if(next===accountScope)return;
    accountScope=next;generation++;inFlight=null;
    document.querySelectorAll('#consoleStatusRefresh,#homeCanonicalRefresh').forEach(button=>button.disabled=false);
    counts=null;attemptedAt=null;verifiedAt=null;state='never';
    favorites.setScope(ready?project:null,ready?user.id:null);renderObserved();
  }
  async function refresh(){
    syncAccount();if(inFlight)return inFlight;
    const current=generation;state='checking';renderObserved();
    document.querySelectorAll('#consoleStatusRefresh,#homeCanonicalRefresh').forEach(button=>button.disabled=true);
    const request=(async()=>{
      const [cloud,local]=await Promise.allSettled([
        refreshCloudSummary({signal:AbortSignal.timeout(8000),requireVerifiedScope:true}),
        cloudSession?.user&&!needsInviteSetup(cloudSession.user)
          ? fetch('http://127.0.0.1:31983/argos/status',{cache:'no-store',signal:AbortSignal.timeout(2500)}).then(async response=>{if(!response.ok)throw Error('Local status unavailable');return response.json();})
          : Promise.reject(new Error('Private local status requires sign-in'))
      ]);
      if(current!==generation)return;
      attemptedAt=new Date();localCheckedAt=attemptedAt;
      localObservation=local.status==='fulfilled'?'responded':'unavailable';
      localState='unknown';
      const result=cloud.status==='fulfilled'?cloud.value:{state:'error'};
      const next=result?.state;
      state=['ready','unavailable','restricted','stale','error'].includes(next)?next:'error';
      if(state==='ready'&&result?.counts){counts=result.counts;verifiedAt=attemptedAt;}
      else{counts=null;verifiedAt=null;}
      favorites.refresh();renderObserved();
    })();
    inFlight=request;
    try{await request;}catch{if(current===generation){state='error';counts=null;verifiedAt=null;attemptedAt=new Date();renderObserved();}}
    finally{if(inFlight===request){inFlight=null;document.querySelectorAll('#consoleStatusRefresh,#homeCanonicalRefresh').forEach(button=>button.disabled=false);}}
  }
  window.SinbadHome={translate,renderObserved,refresh,syncAccount};
  const refreshButton=document.getElementById('consoleStatusRefresh');
  if(refreshButton){[...refreshButton.childNodes].filter(n=>n.nodeType===3).forEach(n=>n.remove());const label=document.createElement('span');label.className='home-refresh-label';refreshButton.prepend(label);}
  const options=document.getElementById('consoleFavoritesOptions');if(options)options.dataset.favoritesList='';
  const status=document.createElement('p');status.id='homeRefreshResult';status.setAttribute('role','status');
  const summary=document.createElement('p');summary.id='homeCloudSummary';
  const data=document.createElement('section');data.className='home-live-data';data.append(status,summary);
  document.querySelector('.console-statusbar')?.after(data);
  function favoriteTargetId(card){
    if(card.hasAttribute('data-open-sinbad-academy'))return 'page:academy.html';
    const tab=card.dataset.targetTab||'';
    const tabId=tab?`captain:tab:${tab}`:'';
    if(card.dataset.open==='sinbad'&&tabId&&Object.prototype.hasOwnProperty.call(catalog,tabId))return tabId;
    return `workspace:${card.dataset.open}`;
  }
  document.querySelectorAll('.console-domain-card,[class*="function-card"][data-open],.console-landing-grid [data-open],.console-all-tools [data-open]').forEach(card=>{const id=favoriteTargetId(card);card.dataset.favoriteTarget=id;favorites.decorate(card,id);});
  document.querySelectorAll('main>.workspace').forEach(workspace=>{const heading=workspace.querySelector('h2');if(heading)favorites.decorate(heading,`workspace:${workspace.id}`);});
  document.querySelectorAll('[data-sinbad-tab]').forEach(tab=>favorites.decorate(tab,`captain:tab:${tab.dataset.sinbadTab}`));
  document.querySelectorAll('.console-domain-card').forEach(card=>{
    let origin=null;
    card.addEventListener('pointerdown',event=>{if(event.button!==0)return;origin={x:event.clientX,y:event.clientY};});
    card.addEventListener('pointercancel',()=>{origin=null;});
    card.addEventListener('click',event=>{
      if(!origin||event.detail===0){origin=null;return;}
      const moved=Math.hypot(event.clientX-origin.x,event.clientY-origin.y);
      origin=null;
      if(moved>12){event.stopImmediatePropagation();event.preventDefault();}
    },true);
  });
  window.SinbadFavoritesNavigate=(id,item)=>{
    if(item.kind==='workspace'&&workspaceWindowId&&item.workspace!=='store'){openWorkspace(item.workspace);return true;}
    if(item.kind==='captain-tab'&&workspaceWindowId){const target=new URL(item.path,location.href);navigateWorkspace('sinbad',{restoreHistory:true});if(target.href!==location.href)history.pushState(null,'',target.href);setSinbadWorkspaceTab(item.tab,{focus:true});return true;}
    if(item.kind==='workspace'||item.kind==='captain-tab'){
      const target=new URL(item.path,location.href),name=item.workspace==='store'?'sinbadMarineStore':`sinbadWorkspace_${item.workspace||'sinbad'}`;
      const child=window.open(target.href,name,workspaceWindowFeatures());if(child){workspaceWindows.set(item.workspace||'sinbad',child);child.focus();}else location.assign(target.href);return true;
    }
    return false;
  };
  const requestedTab=new URLSearchParams(location.search).get('tab');if(workspaceWindowId==='sinbad'&&['chat','academy','argos'].includes(requestedTab))setSinbadWorkspaceTab(requestedTab);
  // Keep the approved desktop positions unless actual control bounds collide.
  function installHomeControlLayout(){
    const account=document.querySelector('.topbar-account-actions');
    const bar=document.querySelector('.console-statusbar');
    const menu=document.querySelector('.hero-action-menu');
    const panel=menu?.querySelector('.action-menu-panel');
    if(!account||!bar||!panel)return;
    const controls=[bar,...document.querySelectorAll('#homeCanonicalMenu,#homeCanonicalRefresh')];
    let pending=false;
    const visibleRect=element=>{
      const rect=element.getBoundingClientRect(),style=getComputedStyle(element);
      return rect.width&&rect.height&&style.visibility!=='hidden'&&style.display!=='none'?rect:null;
    };
    function layout(){
      pending=false;
      account.style.removeProperty('top');
      panel.style.removeProperty('top');panel.style.removeProperty('max-height');panel.style.removeProperty('overflow-y');
      if(innerWidth<1100||!document.body.matches('[data-console-art="monet"]:not(.workspace-window-mode):not(:has(main>.workspace.active))'))return;
      const initial=visibleRect(account);if(!initial)return;
      let top=initial.top;
      const obstacles=controls.map(visibleRect).filter(Boolean).sort((a,b)=>a.top-b.top);
      for(const rect of obstacles){
        if(initial.left<rect.right&&initial.right>rect.left&&top<rect.bottom&&top+initial.height>rect.top)top=Math.max(top,rect.bottom+8);
      }
      if(top>initial.top)account.style.top=`${Math.ceil(top)}px`;
      // The menu already starts 8px below the normal 46px account box.
      // Preserve that position when possible, including when the box wraps.
      const menuTop=Math.max(innerHeight*.07+54,top+initial.height+8);
      panel.style.top=`${Math.ceil(menuTop)}px`;
      panel.style.maxHeight=`${Math.max(0,Math.floor(innerHeight-menuTop-8))}px`;
      panel.style.overflowY='auto';
    }
    function schedule(){if(!pending){pending=true;requestAnimationFrame(layout);}}
    const resize=new ResizeObserver(schedule);
    [account,...controls].forEach(element=>resize.observe(element));
    const changes=new MutationObserver(schedule);
    changes.observe(document.body,{attributes:true,attributeFilter:['class','data-console-art']});
    changes.observe(document.documentElement,{attributes:true,attributeFilter:['lang','dir']});
    changes.observe(bar,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden','class']});
    document.querySelectorAll('main>.workspace').forEach(element=>changes.observe(element,{attributes:true,attributeFilter:['class']}));
    window.addEventListener('resize',schedule,{passive:true});
    menu.addEventListener('toggle',schedule);
    document.fonts?.ready.then(schedule);
    layout();
  }
  translate();syncAccount();favorites.render();
  installHomeControlLayout();
})();
