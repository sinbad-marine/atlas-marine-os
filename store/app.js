import { categories, products } from "./catalog.js";
import { dictionary, localizeProduct, normalizeLocale } from "./i18n.js";

const $ = (selector) => document.querySelector(selector);
const requestedLocale = new URLSearchParams(location.search).get("lang") || localStorage.getItem("sinbad-store-language") || "tr";
let activeLocale = normalizeLocale(requestedLocale);
let text = dictionary(activeLocale);
let money = new Intl.NumberFormat(text.locale, { style: "currency", currency: "TRY", maximumFractionDigits: 0 });

const concept = new URLSearchParams(location.search).get("concept") || "sunset";
const allowedConcepts = new Set(["day", "sunset", "technical"]);
const activeConcept = allowedConcepts.has(concept) ? concept : "day";
document.body.className = `theme-${activeConcept}`;
document.querySelectorAll("[data-concept-link]").forEach((link) => {
  if (link.dataset.conceptLink === activeConcept) link.classList.add("active");
});

const state = { category: "all", query: "", sort: "featured", cart: JSON.parse(sessionStorage.getItem("sinbad-store-cart") || "[]"), compare: [] };
const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);

const translatedProducts = () => products.map((product) => localizeProduct(product, activeLocale));
const translatedProduct = (id) => localizeProduct(products.find((product) => product.id === id), activeLocale);
const setText = (selector, value) => { const node = $(selector); if (node) node.textContent = value; };
const setHtml = (selector, value) => { const node = $(selector); if (node) node.innerHTML = value; };
const setLabel = (selector, value) => { const node = $(selector); if (!node) return; const firstText = [...node.childNodes].find((child) => child.nodeType === Node.TEXT_NODE); if (firstText) firstText.textContent = value; else node.prepend(document.createTextNode(value)); };

function applyStaticTranslations() {
  document.documentElement.lang = activeLocale;
  document.title = "SINBAD Marine Store · Equip the Voyage";
  document.querySelector('meta[name="description"]')?.setAttribute("content", text.metaDescription);
  $("#storeLanguage").value = activeLocale;
  $("#storeLanguage").setAttribute("aria-label", text.languageLabel); setText(".language-picker .sr-only", text.languageLabel);
  const textBindings = [
    [".notice strong", "demo"], [".notice span:last-child", "verificationPending"], ["#megaTrigger", "allCategories"],
    ["#mainNav a:nth-of-type(1)", "navVessel"], ["#mainNav a:nth-of-type(2)", "navGuides"], ["#mainNav a:nth-of-type(3)", "navProfessional"], ["#mainNav a:nth-of-type(4)", "navTrust"],
    ["#megaMenu>div:nth-child(1)>.eyebrow", "productFamilies"], ["#megaMenu>div:nth-child(1) a:nth-of-type(1) b", "lifesaving"], ["#megaMenu>div:nth-child(1) a:nth-of-type(1) small", "lifesavingSmall"], ["#megaMenu>div:nth-child(1) a:nth-of-type(2) b", "bridge"], ["#megaMenu>div:nth-child(1) a:nth-of-type(2) small", "bridgeSmall"], ["#megaMenu>div:nth-child(1) a:nth-of-type(3) b", "electrical"], ["#megaMenu>div:nth-child(1) a:nth-of-type(3) small", "electricalSmall"],
    ["#megaMenu>div:nth-child(2)>.eyebrow", "deckLife"], ["#megaMenu>div:nth-child(2) a:nth-of-type(1) b", "deck"], ["#megaMenu>div:nth-child(2) a:nth-of-type(1) small", "deckSmall"], ["#megaMenu>div:nth-child(2) a:nth-of-type(2) b", "findVessel"], ["#megaMenu>div:nth-child(2) a:nth-of-type(2) small", "findVesselSmall"], ["#megaMenu>div:nth-child(2) a:nth-of-type(3) b", "buyingGuides"], ["#megaMenu>div:nth-child(2) a:nth-of-type(3) small", "buyingGuidesSmall"],
    [".mega-feature .eyebrow", "supplyDesk"], [".mega-feature h3", "etaDelivery"], [".mega-feature button", "createQuote"],
    [".service-rail span:nth-child(1)", "expertSupport"], [".service-rail span:nth-child(2)", "marinaDelivery"], [".service-rail span:nth-child(3)", "controlledData"], [".service-rail span:nth-child(4)", "returns"],
    [".hero-content .eyebrow", "heroEyebrow"], [".hero-content>p:not(.eyebrow)", "heroText"], [".hero-actions a", "explore"], [".hero-actions button", "vesselQuote"], [".hero-facts span:nth-child(1) b", "technicalEvidence"], [".hero-facts span:nth-child(2) b", "b2cB2b"],
    [".quick-find .eyebrow", "smartFinder"], [".quick-find h2", "whatLooking"], ["#findButton", "search"],
    [".finder-copy .eyebrow", "knowVessel"], [".finder-copy>p:last-child", "compatibleText"], ["#vesselType option:nth-child(1)", "motorYacht"], ["#vesselType option:nth-child(2)", "sailing"], ["#vesselType option:nth-child(3)", "commercial"], ["#vesselType option:nth-child(4)", "workboat"], ["#systemType option:nth-child(1)", "safetySystem"], ["#systemType option:nth-child(2)", "bridgeSystem"], ["#systemType option:nth-child(3)", "electricalSystem"], ["#systemType option:nth-child(4)", "deckSystem"], ["#vesselForm button", "showCompatible"], ["#vesselForm>small", "finalCompatibility"],
    [".category-feature.safety p", "safetyHeading"], [".category-feature.safety button", "openCategory"], [".category-feature.bridge p", "bridgeHeading"], [".category-feature.bridge button", "openCategory"], [".category-feature.supply p", "supplyHeading"], [".category-feature.supply button", "createQuoteArrow"],
    ["#catalog .section-heading .eyebrow", "selection"], ["#catalog .section-heading h2", "selectedSea"], ["#catalog .section-heading>p", "provisionalNote"], ["#sortSelect option:nth-child(1)", "featured"], ["#sortSelect option:nth-child(2)", "priceLow"], ["#sortSelect option:nth-child(3)", "priceHigh"], ["#emptyState", "empty"],
    ["#guides .section-heading .eyebrow", "guideEyebrow"], ["#guides .section-heading h2", "knowBefore"], ["#guides .section-heading>p", "guideIntro"], [".guide-grid article:nth-child(1)>span", "guideSafety"], [".guide-grid article:nth-child(1)>p", "lifejacketGuideText"], [".guide-grid article:nth-child(1)>button", "openGuide"], [".guide-grid article:nth-child(2)>span", "guideElectrical"], [".guide-grid article:nth-child(2)>h3", "voltageTitle"], [".guide-grid article:nth-child(2)>p", "voltageText"], [".guide-grid article:nth-child(2)>button", "exploreSystem"], [".guide-grid article:nth-child(3)>span", "guideBridge"], [".guide-grid article:nth-child(3)>h3", "bridgeChecklist"], [".guide-grid article:nth-child(3)>p", "bridgeChecklistText"], [".guide-grid article:nth-child(3)>button", "openList"],
    ["#professional .eyebrow", "proEyebrow"], ["#professional>button", "startProQuote"], ["#sdm>span", "supplierPartner"], ["#sdm>p", "supplierText"],
    ["#trust .eyebrow", "trustEyebrow"], ["#trust h2", "trustTitle"], [".trust-grid article:nth-child(1) h3", "cardTitle"], [".trust-grid article:nth-child(1) p", "cardText"], [".trust-grid article:nth-child(2) h3", "proofTitle"], [".trust-grid article:nth-child(2) p", "proofText"], [".trust-grid article:nth-child(3) h3", "engineTitle"], [".trust-grid article:nth-child(3) p", "engineText"], [".trust-grid article:nth-child(4) h3", "traceTitle"], [".trust-grid article:nth-child(4) p", "traceText"],
    ["footer>div:nth-of-type(2) a:nth-child(1)", "products"], ["footer>div:nth-of-type(2) a:nth-child(2)", "security"], ["footer>div:nth-of-type(2) button", "corporateQuote"], ["footer>small", "footer"],
    ["#cartDrawer .eyebrow", "shoppingCart"], ["#cartDrawer h2", "selected"], [".drawer-foot>div>span", "subtotal"], ["#checkoutButton", "checkoutSoon"], [".drawer-foot>small", "noCard"],
    ["#quoteForm .eyebrow", "professionalSupply"], ["#quoteForm h2", "quoteTitle"], ["#quoteForm>p:not(.eyebrow)", "quoteIntro"], ["#quoteForm>button", "prepareQuote"]
  ];
  textBindings.forEach(([selector, key]) => setText(selector, text[key]));
  [[".hero-content h1", "heroTitle"], [".finder-copy h2", "compatibleTitle"], [".category-feature.safety h3", "safetyTitle"], [".category-feature.bridge h3", "bridgeTitle"], [".category-feature.supply h3", "supplyTitle"], [".guide-grid article:nth-child(1)>h3", "lifejacketGuide"], ["#professional h2", "operationTitle"]].forEach(([selector, key]) => setHtml(selector, text[key]));
  $(".hero-image").setAttribute("aria-label", text.heroImage); $(".brand").setAttribute("aria-label", text.homeLabel); $("#menuButton").setAttribute("aria-label", text.openMenu); $("#mainNav").setAttribute("aria-label", text.mainMenu); $("#megaMenu").setAttribute("aria-label", text.productCategoriesLabel); $(".quick-find").setAttribute("aria-label", text.quickFindLabel); $("#sdm").setAttribute("aria-label", text.supplierNoteLabel); $("#searchButton").setAttribute("aria-label", text.searchLabel); $("#sortSelect").setAttribute("aria-label", text.sortLabel); $("#cartDrawer").setAttribute("aria-label", text.cartLabel); $("[data-close]").setAttribute("aria-label", text.closeCart); document.querySelectorAll("[data-dialog-close]").forEach((button) => button.setAttribute("aria-label", text.close));
  [["#cartButton", "cart"], ["#compareButton", "compare"], [".hero-facts span:nth-child(1)", "docsCompliance"], [".hero-facts span:nth-child(2)", "storeSupply"], ["#vesselForm label:nth-of-type(1)", "vesselType"], ["#vesselForm label:nth-of-type(2)", "systemWanted"], [".pro-steps span:nth-child(1)", "step1"], [".pro-steps span:nth-child(2)", "step2"], [".pro-steps span:nth-child(3)", "step3"], ["#quoteForm .form-grid label:nth-child(1)", "company"], ["#quoteForm .form-grid label:nth-child(2)", "email"], ["#quoteForm .form-grid label:nth-child(3)", "vesselName"], ["#quoteForm .form-grid label:nth-child(4)", "imo"], ["#quoteForm .form-grid label:nth-child(5)", "port"], ["#quoteForm>label", "needs"]].forEach(([selector, key]) => setLabel(selector, text[key]));
  $("#searchInput").placeholder = text.searchPlaceholder; $("#quoteForm textarea").placeholder = text.needsPlaceholder;
}

function toast(message) { const node = $("#toast"); node.textContent = message; node.classList.add("show"); clearTimeout(toast.timer); toast.timer = setTimeout(() => node.classList.remove("show"), 2600); }
function saveCart() { sessionStorage.setItem("sinbad-store-cart", JSON.stringify(state.cart)); renderCart(); }
function openDrawer() { $("#cartDrawer").classList.add("open"); $("#cartDrawer").setAttribute("aria-hidden", "false"); $("#overlay").hidden = false; }
function closeDrawer() { $("#cartDrawer").classList.remove("open"); $("#cartDrawer").setAttribute("aria-hidden", "true"); $("#overlay").hidden = true; }

function renderFilters() {
  $("#filters").innerHTML = categories.map((category) => `<button class="${state.category === category.id ? "active" : ""}" data-category="${category.id}">${escapeHtml(text.categories[category.id])}</button>`).join("");
  $("#filters").querySelectorAll("button").forEach((button) => button.addEventListener("click", () => { state.category = button.dataset.category; renderFilters(); renderProducts(); }));
}

function visibleProducts() {
  const normalized = state.query.toLocaleLowerCase(text.locale).trim();
  const items = translatedProducts().filter((product) => (state.category === "all" || product.category === state.category) && (!normalized || `${product.name} ${product.subtitle} ${product.badge}`.toLocaleLowerCase(text.locale).includes(normalized)));
  return items.sort((a, b) => state.sort === "price-low" ? (a.price ?? Infinity) - (b.price ?? Infinity) : state.sort === "price-high" ? (b.price ?? -1) - (a.price ?? -1) : Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
}

function renderProducts() {
  const items = visibleProducts();
  $("#emptyState").hidden = items.length > 0;
  $("#productGrid").innerHTML = items.map((product) => `<article class="product-card"><label class="compare-choice"><input type="checkbox" data-compare="${product.id}" ${state.compare.includes(product.id) ? "checked" : ""}> ${escapeHtml(text.compare)}</label><div class="product-art"><span class="product-badge">${escapeHtml(product.badge)}</span><strong>${escapeHtml(product.art)}</strong></div><div class="product-info"><small>${escapeHtml(text.categories[product.category] || "")}</small><h3>${escapeHtml(product.name)}</h3><p>${escapeHtml(product.subtitle)}</p><div class="verification-strip"><span>${escapeHtml(text.sourceRecorded)}</span><span>${escapeHtml(text.documentCheck)}</span></div><div class="product-meta"><div><strong>${product.price === null ? escapeHtml(text.requestQuote) : money.format(product.price)}</strong><small>${product.price === null ? escapeHtml(text.corporateSupply) : escapeHtml(text.demoPrice)}</small></div><small>${escapeHtml(product.stock)}</small></div></div><div class="product-actions"><button data-detail="${product.id}">${escapeHtml(text.inspect)}</button><button data-add="${product.id}">${escapeHtml(product.quoteOnly || product.restricted ? text.getQuote : text.addCart)}</button></div></article>`).join("");
  document.querySelectorAll("[data-detail]").forEach((button) => button.addEventListener("click", () => openProduct(button.dataset.detail)));
  document.querySelectorAll("[data-add]").forEach((button) => button.addEventListener("click", () => addProduct(button.dataset.add)));
  document.querySelectorAll("[data-compare]").forEach((input) => input.addEventListener("change", () => toggleCompare(input.dataset.compare, input.checked)));
}

function toggleCompare(id, enabled) {
  if (enabled && !state.compare.includes(id)) {
    if (state.compare.length >= 3) { toast(text.maxCompare); renderProducts(); return; }
    state.compare.push(id);
  } else if (!enabled) state.compare = state.compare.filter((item) => item !== id);
  $("#compareCount").textContent = state.compare.length;
  renderCompare();
}

function renderCompare() {
  const drawer = $("#compareDrawer");
  if (!drawer) return;
  const selected = state.compare.map((id) => translatedProduct(id)).filter(Boolean);
  drawer.querySelector(".compare-grid").innerHTML = selected.length ? selected.map((product) => `<article><small>${escapeHtml(product.badge)}</small><h3>${escapeHtml(product.name)}</h3><p><b>${product.price === null ? escapeHtml(text.quote) : money.format(product.price)}</b></p><ul>${product.spec.map((spec) => `<li>${escapeHtml(spec)}</li>`).join("")}</ul></article>`).join("") : `<article>${escapeHtml(text.comparePrompt)}</article>`;
}

function addProduct(id) {
  const product = translatedProduct(id);
  if (!product) return;
  if (product.quoteOnly || product.restricted) return $("#quoteDialog").showModal();
  state.cart.push(id); saveCart(); openDrawer(); toast(`${product.name} ${text.added}`);
}

function renderCart() {
  const items = state.cart.map((id) => translatedProduct(id)).filter(Boolean);
  $("#cartCount").textContent = items.length;
  $("#cartItems").innerHTML = items.length ? items.map((product, index) => `<div class="cart-row"><div class="cart-thumb">${escapeHtml(product.art)}</div><div><p><b>${escapeHtml(product.name)}</b></p><small>${money.format(product.price)}</small></div><button data-remove="${index}" aria-label="${escapeHtml(text.removeCart)}">×</button></div>`).join("") : `<p class="cart-empty">${text.emptyCart}</p>`;
  $("#cartTotal").textContent = money.format(items.reduce((total, product) => total + product.price, 0));
  document.querySelectorAll("[data-remove]").forEach((button) => button.addEventListener("click", () => { state.cart.splice(Number(button.dataset.remove), 1); saveCart(); }));
}

function openProduct(id) {
  const product = translatedProduct(id); if (!product) return;
  $("#productDetail").innerHTML = `<div class="detail-layout"><div class="product-art"><span class="product-badge">${escapeHtml(product.badge)}</span><strong>${escapeHtml(product.art)}</strong></div><div><p class="eyebrow">${escapeHtml(product.source)}</p><h2>${escapeHtml(product.name)}</h2><p>${escapeHtml(product.subtitle)}</p><h3>${product.price === null ? escapeHtml(text.requestQuote) : money.format(product.price)}</h3><div class="detail-tabs"><button class="active" data-tab="spec">${escapeHtml(text.technicalFeature)}</button><button data-tab="docs">${escapeHtml(text.documents)}</button><button data-tab="fit">${escapeHtml(text.compatibility)}</button></div><div class="detail-panel" id="detailPanel"></div><p class="verification-note">${escapeHtml(text.provisionalRecord)}</p><button class="button primary full" id="dialogAction">${escapeHtml(product.quoteOnly || product.restricted ? text.requestQuoteAction : text.addCart)}</button></div></div>`;
  const panels = { spec: `<ul class="spec-list">${product.spec.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`, docs: `<div class="document-list"><span>${escapeHtml(text.dataSheet)} <i>${escapeHtml(text.pending)}</i></span><span>${escapeHtml(text.certificate)} <i>${escapeHtml(text.ownerReview)}</i></span><span>${escapeHtml(text.installGuide)} <i>${escapeHtml(text.supplierSource)}</i></span></div>`, fit: `<div class="layer-badges"><span>${escapeHtml(text.vesselKind)}</span><span>${escapeHtml(text.voltageSize)}</span><span>${escapeHtml(text.mounting)}</span><span>${escapeHtml(text.region)}</span></div><p>${escapeHtml(text.fitText)}</p>` };
  const renderPanel = (name) => { $("#detailPanel").innerHTML = panels[name]; document.querySelectorAll("[data-tab]").forEach((button) => button.classList.toggle("active", button.dataset.tab === name)); };
  renderPanel("spec"); document.querySelectorAll("[data-tab]").forEach((button) => button.onclick = () => renderPanel(button.dataset.tab));
  $("#productDialog").showModal(); $("#dialogAction").onclick = () => { $("#productDialog").close(); addProduct(id); };
}

function applySearch() { state.query = $("#searchInput").value; renderProducts(); $("#catalog").scrollIntoView({ behavior: "smooth" }); }
function renderCompareShell() {
  $("#compareDrawer")?.remove();
  document.body.insertAdjacentHTML("beforeend", `<aside class="compare-drawer" id="compareDrawer" aria-label="${escapeHtml(text.compare)}"><div class="compare-head"><div><p class="eyebrow">${escapeHtml(text.technicalCompare)}</p><h2>${escapeHtml(text.chosenProducts)}</h2></div><button id="compareClose" aria-label="${escapeHtml(text.closeCompare)}">×</button></div><div class="compare-grid"></div></aside>`);
  $("#compareClose").onclick = () => $("#compareDrawer").classList.remove("open");
}
function setLocale(locale) {
  activeLocale = normalizeLocale(locale); text = dictionary(activeLocale); money = new Intl.NumberFormat(text.locale, { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
  localStorage.setItem("sinbad-store-language", activeLocale);
  const url = new URL(location.href); url.searchParams.set("lang", activeLocale); history.replaceState(null, "", url);
  applyStaticTranslations(); renderCompareShell(); renderFilters(); renderProducts(); renderCart(); renderCompare();
}
renderCompareShell(); applyStaticTranslations(); renderFilters(); renderProducts(); renderCart(); renderCompare();
$("#cartButton").onclick = openDrawer; $("[data-close]").onclick = closeDrawer; $("#overlay").onclick = closeDrawer;
$("#findButton").onclick = applySearch; $("#searchButton").onclick = () => $("#searchInput").focus(); $("#searchInput").addEventListener("keydown", (event) => { if (event.key === "Enter") applySearch(); });
$("#sortSelect").onchange = (event) => { state.sort = event.target.value; renderProducts(); };
$("#menuButton").onclick = () => { const nav = $("#mainNav"); nav.classList.toggle("open"); $("#menuButton").setAttribute("aria-expanded", String(nav.classList.contains("open"))); };
$("#megaTrigger").onclick = () => { const menu = $("#megaMenu"); const open = menu.classList.toggle("open"); menu.hidden = !open; $("#megaTrigger").setAttribute("aria-expanded", String(open)); };
document.querySelectorAll("[data-menu-filter]").forEach((link) => link.addEventListener("click", () => { state.category = link.dataset.menuFilter; renderFilters(); renderProducts(); $("#megaMenu").hidden = true; $("#megaMenu").classList.remove("open"); }));
$("#vesselForm").addEventListener("submit", (event) => { event.preventDefault(); state.category = $("#systemType").value; renderFilters(); renderProducts(); $("#catalog").scrollIntoView({ behavior: "smooth" }); const vessel=$("#vesselType").selectedOptions[0].text; toast(activeLocale==="tr"?`${vessel} ${text.familyOpened}`:activeLocale==="en"?`Relevant product family opened for ${vessel}.`:`Familia de productos pertinente abierta para ${vessel}.`); });
$("#compareButton").onclick = () => $("#compareDrawer").classList.add("open");
document.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () => { state.category = button.dataset.filter; renderFilters(); renderProducts(); $("#catalog").scrollIntoView({ behavior: "smooth" }); }));
document.querySelectorAll("[data-open-quote]").forEach((button) => button.addEventListener("click", () => $("#quoteDialog").showModal()));
document.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));
$("#checkoutButton").onclick = () => toast(text.checkoutDisabled);
$("#quoteForm").addEventListener("submit", () => toast(text.quotePrepared));
$("#storeLanguage").addEventListener("change", (event) => setLocale(event.target.value));
