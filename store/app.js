import { categories, products } from "./catalog.js";

const concept = new URLSearchParams(location.search).get("concept") || "sunset";
const allowedConcepts = new Set(["day", "sunset", "technical"]);
const activeConcept = allowedConcepts.has(concept) ? concept : "day";
document.body.className = `theme-${activeConcept}`;
document.querySelectorAll("[data-concept-link]").forEach((link) => {
  if (link.dataset.conceptLink === activeConcept) link.classList.add("active");
});

const conceptCopy = {
  day: { eyebrow: "YAT · TEKNE · PROFESYONEL GEMİ", title: "Yolculuğu<br><em>doğru ekipmanla</em> başlat.", text: "Deniz güvenliğinden köprüüstü ekipmanlarına, güvenilir ürünleri teknik doğrulama ve uzman desteğiyle keşfedin." },
  sunset: { eyebrow: "DENİZİN RUHU · TECRÜBENİN GÜVENİ", title: "Denize hazır.<br><em>Her ayrıntısıyla.</em>", text: "Yatınızdan ticari filonuza kadar; güvenlik, seyir ve teknik ekipmanı doğrulanabilir ürün bilgisiyle keşfedin." },
  technical: { eyebrow: "TECHNICAL COMMERCE · SDM CATALOGUE", title: "Doğru parçayı<br><em>doğru belgeyle</em> bulun.", text: "Model, üretici kodu, gemi sistemi ve sertifika üzerinden arayın; uyumluluk kararı vermeden önce uzman doğrulaması alın." }
};
const heroCopy = conceptCopy[activeConcept];
const hero = document.querySelector(".hero-content");
hero.querySelector(".eyebrow").textContent = heroCopy.eyebrow;
hero.querySelector("h1").innerHTML = heroCopy.title;
hero.querySelector(":scope > p:not(.eyebrow)").textContent = heroCopy.text;

const state = { category: "all", query: "", sort: "featured", cart: JSON.parse(sessionStorage.getItem("sinbad-store-cart") || "[]"), compare: [] };
const money = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);

function toast(message) { const node = $("#toast"); node.textContent = message; node.classList.add("show"); clearTimeout(toast.timer); toast.timer = setTimeout(() => node.classList.remove("show"), 2600); }
function saveCart() { sessionStorage.setItem("sinbad-store-cart", JSON.stringify(state.cart)); renderCart(); }
function openDrawer() { $("#cartDrawer").classList.add("open"); $("#cartDrawer").setAttribute("aria-hidden", "false"); $("#overlay").hidden = false; }
function closeDrawer() { $("#cartDrawer").classList.remove("open"); $("#cartDrawer").setAttribute("aria-hidden", "true"); $("#overlay").hidden = true; }

function renderFilters() {
  $("#filters").innerHTML = categories.map((category) => `<button class="${state.category === category.id ? "active" : ""}" data-category="${category.id}">${escapeHtml(category.label)}</button>`).join("");
  $("#filters").querySelectorAll("button").forEach((button) => button.addEventListener("click", () => { state.category = button.dataset.category; renderFilters(); renderProducts(); }));
}

function visibleProducts() {
  const normalized = state.query.toLocaleLowerCase("tr-TR").trim();
  const items = products.filter((product) => (state.category === "all" || product.category === state.category) && (!normalized || `${product.name} ${product.subtitle} ${product.badge}`.toLocaleLowerCase("tr-TR").includes(normalized)));
  return items.sort((a, b) => state.sort === "price-low" ? (a.price ?? Infinity) - (b.price ?? Infinity) : state.sort === "price-high" ? (b.price ?? -1) - (a.price ?? -1) : Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
}

function renderProducts() {
  const items = visibleProducts();
  $("#emptyState").hidden = items.length > 0;
  $("#productGrid").innerHTML = items.map((product) => `<article class="product-card"><label class="compare-choice"><input type="checkbox" data-compare="${product.id}" ${state.compare.includes(product.id) ? "checked" : ""}> Karşılaştır</label><div class="product-art"><span class="product-badge">${escapeHtml(product.badge)}</span><strong>${escapeHtml(product.art)}</strong></div><div class="product-info"><small>${escapeHtml(categories.find((c) => c.id === product.category)?.label || "")}</small><h3>${escapeHtml(product.name)}</h3><p>${escapeHtml(product.subtitle)}</p><div class="verification-strip"><span>Kaynak kayıtlı</span><span>Belge kontrolü</span></div><div class="product-meta"><div><strong>${product.price === null ? "Teklif alın" : money.format(product.price)}</strong><small>${product.price === null ? "Kurumsal tedarik" : "Demo fiyat"}</small></div><small>${escapeHtml(product.stock)}</small></div></div><div class="product-actions"><button data-detail="${product.id}">İncele</button><button data-add="${product.id}">${product.quoteOnly || product.restricted ? "Teklif al" : "Sepete ekle"}</button></div></article>`).join("");
  document.querySelectorAll("[data-detail]").forEach((button) => button.addEventListener("click", () => openProduct(button.dataset.detail)));
  document.querySelectorAll("[data-add]").forEach((button) => button.addEventListener("click", () => addProduct(button.dataset.add)));
  document.querySelectorAll("[data-compare]").forEach((input) => input.addEventListener("change", () => toggleCompare(input.dataset.compare, input.checked)));
}

function toggleCompare(id, enabled) {
  if (enabled && !state.compare.includes(id)) {
    if (state.compare.length >= 3) { toast("Aynı anda en fazla 3 ürün karşılaştırılabilir."); renderProducts(); return; }
    state.compare.push(id);
  } else if (!enabled) state.compare = state.compare.filter((item) => item !== id);
  $("#compareCount").textContent = state.compare.length;
  renderCompare();
}

function renderCompare() {
  const drawer = $("#compareDrawer");
  if (!drawer) return;
  const selected = state.compare.map((id) => products.find((product) => product.id === id)).filter(Boolean);
  drawer.querySelector(".compare-grid").innerHTML = selected.length ? selected.map((product) => `<article><small>${escapeHtml(product.badge)}</small><h3>${escapeHtml(product.name)}</h3><p><b>${product.price === null ? "Teklif" : money.format(product.price)}</b></p><ul>${product.spec.map((spec) => `<li>${escapeHtml(spec)}</li>`).join("")}</ul></article>`).join("") : "<article>Karşılaştırmak için ürün kartlarından seçim yapın.</article>";
}

function addProduct(id) {
  const product = products.find((item) => item.id === id);
  if (!product) return;
  if (product.quoteOnly || product.restricted) return $("#quoteDialog").showModal();
  state.cart.push(id); saveCart(); openDrawer(); toast(`${product.name} sepete eklendi`);
}

function renderCart() {
  const items = state.cart.map((id) => products.find((product) => product.id === id)).filter(Boolean);
  $("#cartCount").textContent = items.length;
  $("#cartItems").innerHTML = items.length ? items.map((product, index) => `<div class="cart-row"><div class="cart-thumb">${escapeHtml(product.art)}</div><div><p><b>${escapeHtml(product.name)}</b></p><small>${money.format(product.price)}</small></div><button data-remove="${index}" aria-label="Ürünü sepetten çıkar">×</button></div>`).join("") : '<p class="cart-empty">Sepetiniz henüz boş.<br>Deniz için doğru ekipmanı keşfedin.</p>';
  $("#cartTotal").textContent = money.format(items.reduce((total, product) => total + product.price, 0));
  document.querySelectorAll("[data-remove]").forEach((button) => button.addEventListener("click", () => { state.cart.splice(Number(button.dataset.remove), 1); saveCart(); }));
}

function openProduct(id) {
  const product = products.find((item) => item.id === id); if (!product) return;
  $("#productDetail").innerHTML = `<div class="detail-layout"><div class="product-art"><span class="product-badge">${escapeHtml(product.badge)}</span><strong>${escapeHtml(product.art)}</strong></div><div><p class="eyebrow">${escapeHtml(product.source)}</p><h2>${escapeHtml(product.name)}</h2><p>${escapeHtml(product.subtitle)}</p><h3>${product.price === null ? "Teklif alın" : money.format(product.price)}</h3><div class="detail-tabs"><button class="active" data-tab="spec">Teknik özellik</button><button data-tab="docs">Belgeler</button><button data-tab="fit">Uyumluluk</button></div><div class="detail-panel" id="detailPanel"></div><p class="verification-note">Bu prototip kaydı provizyoneldir. Ürün kodu, stok, fiyat, sertifika ve teknik değerler SDM tarafından doğrulandıktan sonra satışa açılır.</p><button class="button primary full" id="dialogAction">${product.quoteOnly || product.restricted ? "Teklif iste" : "Sepete ekle"}</button></div></div>`;
  const panels = { spec: `<ul class="spec-list">${product.spec.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`, docs: `<div class="document-list"><span>Teknik veri sayfası <i>Doğrulama bekliyor</i></span><span>Sertifika / uygunluk <i>Owner kontrolü</i></span><span>Kurulum kılavuzu <i>Tedarikçi kaynağı</i></span></div>`, fit: `<div class="layer-badges"><span>Gemi tipi</span><span>Gerilim / ölçü</span><span>Montaj alanı</span><span>Sertifika bölgesi</span></div><p>Kesin uyumluluk gemi ve ürün kodu birlikte doğrulanınca yayınlanır.</p>` };
  const renderPanel = (name) => { $("#detailPanel").innerHTML = panels[name]; document.querySelectorAll("[data-tab]").forEach((button) => button.classList.toggle("active", button.dataset.tab === name)); };
  renderPanel("spec"); document.querySelectorAll("[data-tab]").forEach((button) => button.onclick = () => renderPanel(button.dataset.tab));
  $("#productDialog").showModal(); $("#dialogAction").onclick = () => { $("#productDialog").close(); addProduct(id); };
}

function applySearch() { state.query = $("#searchInput").value; renderProducts(); $("#catalog").scrollIntoView({ behavior: "smooth" }); }
document.body.insertAdjacentHTML("beforeend", `<aside class="compare-drawer" id="compareDrawer" aria-label="Ürün karşılaştırma"><div class="compare-head"><div><p class="eyebrow">TEKNİK KARŞILAŞTIRMA</p><h2>Seçtiğiniz ürünler</h2></div><button id="compareClose" aria-label="Karşılaştırmayı kapat">×</button></div><div class="compare-grid"></div></aside>`);
renderFilters(); renderProducts(); renderCart(); renderCompare();
$("#cartButton").onclick = openDrawer; $("[data-close]").onclick = closeDrawer; $("#overlay").onclick = closeDrawer;
$("#findButton").onclick = applySearch; $("#searchButton").onclick = () => $("#searchInput").focus(); $("#searchInput").addEventListener("keydown", (event) => { if (event.key === "Enter") applySearch(); });
$("#sortSelect").onchange = (event) => { state.sort = event.target.value; renderProducts(); };
$("#menuButton").onclick = () => { const nav = $("#mainNav"); nav.classList.toggle("open"); $("#menuButton").setAttribute("aria-expanded", String(nav.classList.contains("open"))); };
$("#megaTrigger").onclick = () => { const menu = $("#megaMenu"); const open = menu.classList.toggle("open"); menu.hidden = !open; $("#megaTrigger").setAttribute("aria-expanded", String(open)); };
document.querySelectorAll("[data-menu-filter]").forEach((link) => link.addEventListener("click", () => { state.category = link.dataset.menuFilter; renderFilters(); renderProducts(); $("#megaMenu").hidden = true; $("#megaMenu").classList.remove("open"); }));
$("#vesselForm").addEventListener("submit", (event) => { event.preventDefault(); state.category = $("#systemType").value; renderFilters(); renderProducts(); $("#catalog").scrollIntoView({ behavior: "smooth" }); toast(`${$("#vesselType").selectedOptions[0].text} için ilgili ürün ailesi açıldı.`); });
$("#compareButton").onclick = () => $("#compareDrawer").classList.add("open"); $("#compareClose").onclick = () => $("#compareDrawer").classList.remove("open");
document.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () => { state.category = button.dataset.filter; renderFilters(); renderProducts(); $("#catalog").scrollIntoView({ behavior: "smooth" }); }));
document.querySelectorAll("[data-open-quote]").forEach((button) => button.addEventListener("click", () => $("#quoteDialog").showModal()));
document.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));
$("#checkoutButton").onclick = () => toast("Demo güvenliği: banka entegrasyonu gelene kadar ödeme kapalı.");
$("#quoteForm").addEventListener("submit", () => toast("Demo teklif hazırlandı; hiçbir bilgi gönderilmedi."));
