export const categories = [
  { id: "all", label: "Tüm Ürünler" },
  { id: "safety", label: "Can Kurtarma" },
  { id: "bridge", label: "Seyir & Köprüüstü" },
  { id: "electrical", label: "Marin Elektrik" },
  { id: "deck", label: "Güverte" },
  { id: "professional", label: "Profesyonel Tedarik" }
];

export const products = [
  { id: "sdm-lifejacket-light", category: "safety", badge: "SDM", art: "LIGHT", name: "Can Yeleği Işığı SDM", subtitle: "Acil durum görünürlük ışığı", price: 378, stock: "Tedarikçiden doğrulanacak", spec: ["Sertifika belgesi bekleniyor", "Pil/aktivasyon tipi doğrulanacak"], source: "SDM / Deniz Mağaza", featured: true },
  { id: "lifejacket-100n", category: "safety", badge: "100N", art: "100N", name: "Can Yeleği 100N", subtitle: "Kıyı ve korunaklı su kullanımı", price: 563, stock: "Tedarikçiden doğrulanacak", spec: ["Beden ve taşıma kapasitesi doğrulanacak", "Uygunluk belgesi bekleniyor"], source: "Deniz Mağaza", featured: true },
  { id: "lifejacket-solas", category: "safety", badge: "SOLAS?", art: "SOLAS", name: "Can Yeleği — SOLAS Listeli", subtitle: "Belge doğrulaması sonrası satışa açılır", price: 991, stock: "Satışa kapalı · belge kontrolü", spec: ["MED/SOLAS belgesi zorunlu", "Model ve beden bilgisi bekleniyor"], source: "Deniz Mağaza", restricted: true },
  { id: "parallel-ruler", category: "bridge", badge: "SEYİR", art: "//", name: "Paralel Cetvel", subtitle: "Harita masası seyir ekipmanı", price: 521, stock: "Tedarikçiden doğrulanacak", spec: ["Ölçü ve malzeme bilgisi bekleniyor", "Köprüüstü ekipmanı"], source: "Deniz Mağaza", featured: true },
  { id: "chrome-divider", category: "bridge", badge: "SEYİR", art: "⌁", name: "Krom Pergel", subtitle: "Profesyonel harita çalışma pergeli", price: 420, stock: "Tedarikçiden doğrulanacak", spec: ["Krom gövde", "Boy bilgisi doğrulanacak"], source: "Deniz Mağaza" },
  { id: "horn-24v", category: "electrical", badge: "24V", art: "24V", name: "Borulu Marin Korna 24V", subtitle: "Tekne ve yat ses işaret cihazı", price: 3998, stock: "Tedarikçiden doğrulanacak", spec: ["24 V DC", "dB ve tip onayı bilgisi bekleniyor"], source: "Deniz Mağaza", featured: true },
  { id: "clinometer", category: "bridge", badge: "BRIDGE", art: "±°", name: "Yalpametre", subtitle: "Köprüüstü meyil göstergesi", price: 4939, stock: "Tedarikçiden doğrulanacak", spec: ["Ölçüm aralığı doğrulanacak", "Montaj ölçüsü bekleniyor"], source: "Deniz Mağaza" },
  { id: "captain-chair", category: "deck", badge: "YAT", art: "SEAT", name: "Kaptan Koltuğu", subtitle: "Yat ve profesyonel kullanım", price: 23990, stock: "Teklif ve stok sorunuz", spec: ["Döşeme seçeneği doğrulanacak", "Kaide dahil/hariç bilgisi bekleniyor"], source: "Deniz Mağaza" },
  { id: "ship-supply", category: "professional", badge: "B2B", art: "RFQ", name: "Gemi Malzemeleri Tedariki", subtitle: "Limana veya gemiye toplu teslimat", price: null, stock: "Teklif usulü", spec: ["Gemi/IMO ve liman bilgisi", "ETA bazlı tedarik planı"], source: "SDM Marine", quoteOnly: true, featured: true }
];
