/* Browser-local, account-scoped route bookmarks. No credentials or private content. */
(function(root){
  'use strict';
  // Owner 2026-10-11: visitors keep their own browser-local favorites, separate from any member list; sign-in does not merge, sign-out returns to the visitor list.
  const VISITOR_KEY='sinbad_favorites_v2:visitor';
  function createStore({storage,catalog,onChange=()=>{}}){
    let key=null,ids=[],failure='';
    const valid=id=>typeof id==='string'&&Object.prototype.hasOwnProperty.call(catalog,id);
    const read=()=>{failure='';try{const value=key?JSON.parse(storage.getItem(key)||'[]'):[];if(!Array.isArray(value))throw Error('Invalid favorites');ids=[...new Set(value.filter(valid))];}catch{ids=[];failure='read';}};
    return {
      scope(project,userId){const next=project&&userId?`sinbad_favorites_v2:${encodeURIComponent(project)}:${encodeURIComponent(userId)}`:VISITOR_KEY;if(next===key)return;key=next;read();onChange();},
      refresh(){read();onChange();},
      snapshot(){return {key,ids:[...ids],enabled:Boolean(key),failure};},
      toggle(id){if(!key||!valid(id))return false;read();if(failure)return false;const next=ids.includes(id)?ids.filter(x=>x!==id):[...ids,id];try{storage.setItem(key,JSON.stringify(next));ids=next;failure='';onChange();return true;}catch{failure='write';onChange();return false;}},
      has(id){return ids.includes(id);}
    };
  }
  function openStorage(getStorage){
    try{
      const storage=typeof getStorage==='function'?getStorage():getStorage;
      if(!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function')throw new Error('storage-blocked');
      return storage;
    }catch{
      return {getItem(){throw new Error('storage-blocked');},setItem(){throw new Error('storage-blocked');}};
    }
  }
  function invitePending(getSessionStorage,href){
    try{if(getSessionStorage().getItem('sinbad_pending_invite_setup')==='1')return true;}catch{return true;}
    return /(?:[?#&])type=invite(?:&|$)|[?&]invite=(?:1|true)(?:&|$)/i.test(String(href||''));
  }
  function accountReady(user,pending){
    return Boolean(user&&!pending&&(!user.invited_at||user.user_metadata?.sinbad_account_ready===true));
  }
  if(typeof module==='object'&&module.exports){module.exports={createStore,openStorage,invitePending,accountReady};return;}
  const base=new URL('.',document.currentScript.src);
  const catalog=root.SinbadFavoritesCatalog||Object.create(null),buttons=new Map();
  let popoverInteractive=false,hoverTimer=null;
  let language='en-US',popover=null,trigger=null,authSubscription=null,scopeGeneration=0;
  try{language=openStorage(()=>localStorage).getItem('atlas_app_language')||'en-US';}catch{language='en-US';}
  const codes=['en','tr','ru','de','ar','es','fr'];
  const codeOf=value=>{const code=String(value||'en').toLowerCase().slice(0,2);return codes.includes(code)?code:'en';};
  const words={
    en:{favorites:'Favorites',add:'Add to favorites',remove:'Remove from favorites',empty:'No favorites yet. Use a star on a page or card.',signin:'Sign in to save your favorites.',local:'Saved for this account in this browser. No device sync.',error:'Favorites could not be saved in this browser.',close:'Close',openHint:'Double-click or press Enter to open'},
    tr:{favorites:'Favoriler',add:'Favorilere ekle',remove:'Favorilerden çıkar',empty:'Henüz favori yok. Bir sayfa veya kartın yıldızını kullanın.',signin:'Favorilerinizi kaydetmek için giriş yapın.',local:'Bu hesap için bu tarayıcıda saklanır. Cihazlar arası eşitleme yok.',error:'Favoriler bu tarayıcıda kaydedilemedi.',close:'Kapat',openHint:'Açmak için çift tıklayın veya Enter’a basın'},
    ru:{favorites:'Избранное',add:'Добавить в избранное',remove:'Убрать из избранного',empty:'Избранного пока нет. Используйте звезду на странице или карточке.',signin:'Войдите, чтобы сохранить избранное.',local:'Хранится для этой учётной записи в этом браузере. Синхронизации между устройствами нет.',error:'Не удалось сохранить избранное в этом браузере.',close:'Закрыть',openHint:'Откройте двойным щелчком или клавишей Enter'},
    de:{favorites:'Favoriten',add:'Zu Favoriten hinzufügen',remove:'Aus Favoriten entfernen',empty:'Noch keine Favoriten. Nutzen Sie den Stern auf einer Seite oder Karte.',signin:'Melden Sie sich an, um Favoriten zu speichern.',local:'Für dieses Konto in diesem Browser gespeichert. Kein Abgleich zwischen Geräten.',error:'Favoriten konnten in diesem Browser nicht gespeichert werden.',close:'Schließen',openHint:'Zum Öffnen doppelklicken oder die Eingabetaste drücken'},
    ar:{favorites:'المفضلة',add:'أضف إلى المفضلة',remove:'أزل من المفضلة',empty:'لا توجد مفضلة بعد. استخدم النجمة على الصفحة أو البطاقة.',signin:'سجّل الدخول لحفظ المفضلة.',local:'يُحفظ لهذا الحساب في هذا المتصفح. لا توجد مزامنة بين الأجهزة.',error:'تعذر حفظ المفضلة في هذا المتصفح.',close:'إغلاق',openHint:'افتح بنقرة مزدوجة أو بمفتاح الإدخال'},
    es:{favorites:'Favoritos',add:'Añadir a favoritos',remove:'Quitar de favoritos',empty:'Aún no hay favoritos. Use la estrella de una página o tarjeta.',signin:'Inicie sesión para guardar sus favoritos.',local:'Guardado para esta cuenta en este navegador. Sin sincronización entre dispositivos.',error:'No se pudieron guardar los favoritos en este navegador.',close:'Cerrar',openHint:'Abra con doble clic o con la tecla Intro'},
    fr:{favorites:'Favoris',add:'Ajouter aux favoris',remove:'Retirer des favoris',empty:'Aucun favori pour le moment. Utilisez l’étoile d’une page ou d’une carte.',signin:'Connectez-vous pour enregistrer vos favoris.',local:'Enregistré pour ce compte dans ce navigateur. Aucune synchronisation entre appareils.',error:'Les favoris n’ont pas pu être enregistrés dans ce navigateur.',close:'Fermer',openHint:'Ouvrez par double clic ou avec Entrée'}
  };
  const t=key=>words[codeOf(language)][key]||words.en[key];
  const label=id=>{const item=catalog[id];if(!item)return id;return item[codeOf(language)]||item.en||id;};
  const node=(tag,text,className)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(className)n.className=className;return n;};
  const store=createStore({storage:openStorage(()=>localStorage),catalog,onChange:render});
  function closePopover(){clearTimeout(hoverTimer);popover?.remove();popover=null;if(trigger?.isConnected){trigger.setAttribute('aria-expanded','false');if(popoverInteractive)trigger.focus({preventScroll:true});}trigger=null;}
  function showPopover(button,id,interactive=true){if(trigger===button&&popover){if(interactive){popoverInteractive=true;popover.querySelector('button:not(:disabled)')?.focus();}return;}closePopover();popoverInteractive=interactive;trigger=button;button.setAttribute('aria-expanded','true');popover=node('div',null,'sinbad-favorite-popover');popover.setAttribute('role','dialog');popover.setAttribute('aria-label',t('favorites'));popover.append(node('strong',label(id)),node('p',store.snapshot().enabled?t('local'):t('signin')));const action=node('button',store.has(id)?'−':'+','sinbad-favorite-icon-button');action.type='button';action.setAttribute('aria-label',t(store.has(id)?'remove':'add'));action.disabled=!store.snapshot().enabled;action.onclick=event=>{event.stopPropagation();if(store.toggle(id))closePopover();else{const message=node('p',t('error'));message.setAttribute('role','alert');popover?.append(message);}};const close=node('button','×','sinbad-favorite-icon-button');close.type='button';close.setAttribute('aria-label',t('close'));close.onclick=event=>{event.stopPropagation();closePopover();};popover.append(action,close);document.body.append(popover);const r=button.getBoundingClientRect();popover.style.left=`${Math.max(8,Math.min(innerWidth-296,r.right-280))}px`;popover.style.top=`${Math.max(8,Math.min(innerHeight-popover.offsetHeight-8,r.bottom+4))}px`;if(interactive)close.focus({preventScroll:true});popover.onmouseenter=()=>clearTimeout(hoverTimer);popover.onmouseleave=()=>{if(!popoverInteractive)hoverTimer=setTimeout(closePopover,180);};}
  function decorate(element,id){if(!Object.prototype.hasOwnProperty.call(catalog,id))return;if(buttons.has(element)){const previous=buttons.get(element);if(previous.dataset.favoriteId===id)return;previous.remove();buttons.delete(element);}if(element.matches('h1,h2,h3,summary,select,.native-brand,.sinbad-workspace-tab,.gasm-subject-button,.console-tool-grid button'))element.classList.add('sinbad-favorite-target-compact');const button=node('button','☆','sinbad-favorite-star');button.type='button';button.dataset.favoriteId=id;button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-expanded','false');button.onclick=event=>{event.stopPropagation();showPopover(button,id);};button.onpointerenter=event=>{if(event.pointerType==='mouse')hoverTimer=setTimeout(()=>showPopover(button,id,false),300);};button.onpointerleave=()=>{clearTimeout(hoverTimer);if(!popoverInteractive)hoverTimer=setTimeout(closePopover,180);};document.body.append(button);buttons.set(element,button);render();}
  let layoutPending=false;
  function layout(){
    layoutPending=false;
    for(const [target,button] of buttons){
      if(!target.isConnected){button.remove();buttons.delete(target);continue;}
      const r=target.getBoundingClientRect(),style=getComputedStyle(target);let left=r.left,top=r.top,right=r.right,bottom=r.bottom,hidden=!r.width||!r.height||style.visibility==='hidden'||Boolean(target.closest('[hidden]'));
      for(let parent=target.parentElement;parent;parent=parent.parentElement){
        if(parent.matches('details:not([open])')&&!(target.matches('summary')&&target.parentElement===parent))hidden=true;
        // Root scrolling is clipped by the viewport, not the body's moving content rectangle.
        if(parent===document.body||parent===document.documentElement)continue;
        const css=getComputedStyle(parent),rect=parent.getBoundingClientRect();
        if(/auto|scroll|hidden|clip/.test(css.overflowY)){top=Math.max(top,rect.top);bottom=Math.min(bottom,rect.bottom);}
        if(/auto|scroll|hidden|clip/.test(css.overflowX)){left=Math.max(left,rect.left);right=Math.min(right,rect.right);}
      }
      top=Math.max(0,top);bottom=Math.min(innerHeight,bottom);left=Math.max(0,left);right=Math.min(innerWidth,right);
      hidden ||= bottom-top<44||right-left<44;
      if(!hidden){
        const rtl=document.documentElement.dir==='rtl';
        const x=rtl?left+8:right-46;
        const probeX=rtl?Math.min(right-8,left+24):right-24;
        button.style.left=`${x}px`;button.style.top=`${top+2}px`;
        button.style.pointerEvents='none';const hit=document.elementFromPoint(probeX,top+24);button.style.pointerEvents='';
        hidden=!(hit&&(target===hit||target.contains(hit)));
      }
      if(button.hidden!==hidden)button.hidden=hidden;
    }
  }
  function scheduleLayout(){if(!layoutPending){layoutPending=true;requestAnimationFrame(layout);}}
  function open(id){if(!Object.prototype.hasOwnProperty.call(catalog,id))return;const item=catalog[id];if(root.SinbadFavoritesNavigate?.(id,item)===true)return;location.assign(new URL(item.path,base).href);}
  let gestureAt=0;
  function openFromGesture(id){const now=performance.now();if(now-gestureAt<450)return;gestureAt=now;open(id);}
  function bindFavoriteOpen(go,id){
    go.setAttribute('aria-keyshortcuts','Enter');
    go.setAttribute('aria-label',`${label(id)}. ${t('openHint')}`);
    let point=null,lastTap=0;
    go.addEventListener('dblclick',event=>{event.preventDefault();openFromGesture(id);});
    go.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openFromGesture(id);}});
    go.addEventListener('pointerdown',event=>{if(event.pointerType==='mouse'||event.button!==0)return;point={x:event.clientX,y:event.clientY};});
    go.addEventListener('pointerup',event=>{
      if(event.pointerType==='mouse'||!point)return;
      const moved=Math.hypot(event.clientX-point.x,event.clientY-point.y);point=null;
      if(moved>12){lastTap=0;return;}
      const now=event.timeStamp;
      if(now-lastTap<400&&now-lastTap>30){event.preventDefault();lastTap=0;openFromGesture(id);}
      else lastTap=now;
    });
  }
  function render(){for(const [,button]of buttons){const id=button.dataset.favoriteId;button.textContent=store.has(id)?'★':'☆';button.title=`${t(store.has(id)?'remove':'add')} · ${label(id)}`;button.setAttribute('aria-label',button.title);button.setAttribute('aria-pressed',String(store.has(id)));}document.querySelectorAll('[data-favorites-list]').forEach(list=>{list.replaceChildren();const snapshot=store.snapshot();if(snapshot.failure){const error=node('p',t('error'));error.setAttribute('role','alert');list.append(error);}if(!snapshot.ids.length){list.append(node('p',snapshot.enabled?t('empty'):t('signin')));return;}for(const id of snapshot.ids){const row=node('div',null,'sinbad-favorite-row'),go=node('button',label(id));go.type='button';go.dataset.favoriteOpen=id;bindFavoriteOpen(go,id);row.append(go);list.append(row);}list.append(node('small',t('local')));});scheduleLayout();}
  async function bindAuth(client,project){const generation=++scopeGeneration;authSubscription?.unsubscribe();authSubscription=null;closePopover();store.scope(null,null);if(!client)return;const apply=session=>{if(generation!==scopeGeneration)return;closePopover();const user=session?.user;const pending=invitePending(()=>sessionStorage,location.href);const ready=accountReady(user,pending);store.scope(ready?project:null,ready?user.id:null);};let authEvent=0;const subscription=client.auth.onAuthStateChange((_event,session)=>{authEvent++;apply(session);});authSubscription=subscription.data?.subscription;const initialEvent=authEvent;try{const {data,error}=await client.auth.getSession();if(!error&&authEvent===initialEvent)apply(data?.session);}catch{/* Fail closed until an actual auth event. */}}
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&popover){event.preventDefault();closePopover();}if(event.key==='Tab'&&popover&&popoverInteractive){const focusable=[...popover.querySelectorAll('button:not(:disabled)')],first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}});
  root.addEventListener('storage',event=>{if(['atlas_supabase_url','atlas_supabase_publishable_key'].includes(event.key)){scopeGeneration++;closePopover();store.scope(null,null);}if(event.key===store.snapshot().key||event.key===null){closePopover();store.refresh();}if(event.key==='atlas_app_language'){language=event.newValue||'en-US';render();}});
  root.addEventListener('scroll',scheduleLayout,true);root.addEventListener('resize',scheduleLayout);new MutationObserver(mutations=>{const outside=mutations.some(mutation=>{const node=mutation.target.nodeType===1?mutation.target:mutation.target.parentElement;return !node?.closest('.sinbad-favorite-star,.sinbad-favorite-popover');});if(outside)scheduleLayout();}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['class','hidden','open','data-academy-view','data-academy-active']});new MutationObserver(scheduleLayout).observe(document.documentElement,{attributes:true,attributeFilter:['dir']});
  root.SinbadFavorites={decorate,open,render,bindAuth,setScope(project,userId){scopeGeneration++;closePopover();store.scope(project,userId);},setLanguage(value){language=value;closePopover();render();},refresh(){store.refresh();},label};
})(typeof window==='object'?window:globalThis);
