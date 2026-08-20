# Sinbad Navigation Engine

Bağımsız, test edilebilir deniz seyir matematiği motoru çalışma alanı.

## Durum

- Başlangıç kaynağı: `atlas_core_audit_2e_full/sinbad-navigation.js`
- Kaynak snapshot tarihi: 2026-08-11
- İlk bağımsızlaştırma tarihi: 2026-08-20
- Lisans/provenans kesinleşene kadar paket `private` ve `UNLICENSED` tutulur.
- Operasyonel gemi seyri için onaylı değildir; araştırma ve doğrulama aşamasındadır.

## Çalıştırma

```powershell
npm test
```

WGS84 jeodezi için sürümü sabitlenmiş `geographiclib-geodesic` bağımlılığı kullanılır. Test çatısı Node.js'in yerleşik `node:test` modülüdür.

## Mevcut yetenek grupları

- Koordinat ayrıştırma ve biçimlendirme
- DR/EP, hız–mesafe–zaman
- Rhumb-line, great-circle ve waypoint üretimi
- Plane/middle-latitude sailing ve traverse
- Akıntı set–drift, course to steer ve leeway
- CPA/TCPA, radar relative motion ve trial manoeuvre
- Cross-track, rota koridoru, ETA ve wheel-over
- UKC, squat, gelgit, secondary-port ve tidal stream
- Demirleme, swing circle ve stopping distance
- Sextant düzeltmeleri ve temel celestial fix/intercept
- Arama-kurtarma datum ve pattern hesapları
- Rüzgâr üçgeni, Beaufort ve wave encounter
- Türkçe soru ayrıştırma ve eksik girdide güvenli durma

## WGS-84 geodesy API

```js
const wgs84 = require("./src/wgs84-geodesy.js");

const inverse = wgs84.inverse(41.0, 29.0, 40.0, -74.0);
const destination = wgs84.direct(41.0, 29.0, 270.0, 1000.0);
```

Yeni API, kullanılan Dünya modelini, yöntemi, birimleri, bağımlılık sürümünü ve doğrulama durumunu sonuç metadata'sında bildirir. Eski küresel great-circle fonksiyonlarının anlamı değiştirilmemiştir.

## Güvenli birleşik API

```js
const navigation = require(".");

const route = navigation.inverseRoute({
  earthModel: navigation.EARTH_MODELS.WGS84,
  lat1: 41,
  lon1: 29,
  lat2: 40,
  lon2: -74
});
```

`earthModel` zorunludur. `SPHERE` hızlı eğitim yaklaşımını, `WGS84` ise elipsoidal jeodeziyi seçer. Sessiz varsayılan kullanılmaz.

## Koordinatlı rota planı

`calculateRoutePlan`, benzersiz kimlik ve koordinat taşıyan en az iki waypoint ister. Yalnızca liman adlarından oluşan listeler rota hesabına kabul edilmez. Her bacak aynı açıkça seçilmiş Dünya modeliyle hesaplanır; toplam mesafe, yöntem metadata'sı ve emniyet uyarısı birlikte döner.

## Rota revizyon bütünlüğü

`createRouteRevision` rota planını yazar, gerekçe, UTC zaman damgası ve önceki revizyonun SHA-256 kimliğiyle mühürler. `verifyRouteRevision` içerik değişikliğini, `verifyRevisionChain` ise silinmiş, sırası bozulmuş veya yanlış bağlanmış revizyonları tespit eder. Bu mekanizma elektronik imza veya yetkilendirilmiş ECDIS onayı yerine geçmez.

## Hesap doğrulama kapısı

`verifyInverseAgainstReference`, sağlayıcı/sürüm/test kimliği bulunan harici bir referansla mesafe ve kerterizleri açık toleranslara göre karşılaştırır; tolerans aşılırsa `HOLD` döndürür. `verifyDirectInverseClosure` yalnız iç tutarlılık testidir ve özellikle bağımsız doğrulama olarak etiketlenmez.

## Rota yayın kapısı

`assessRouteRelease`, rota revizyon zincirini ve her bacağın bağımsız doğrulama kanıtını kontrol eder. Teknik kontroller tam olsa bile insan onayı yoksa sonuç `READY_FOR_HUMAN_APPROVAL` olur. Yalnız tam revizyon hash'i için açıkça kaydedilmiş insan kararıyla `RELEASED` döner; bu durum klas, bayrak, ECDIS veya yasal onay anlamına gelmez.

## Girdi provenansı ve güncellik

`assessInputProvenance` canlı sensör, canlı servis, manuel gözlem ve statik yayın kaynaklarını ayrı kurallarla değerlendirir. Canlı veri için kaynak, gözlem zamanı ve pozitif azami yaş; statik yayın için kaynak ve edisyon zorunludur. Eski veya gelecekte zaman damgalı veri `HOLD` üretir. `assessInputSet`, bir hesap için gereken bütün girdileri tek kapıda denetler.

## Bağımsız mevki çapraz kontrolü

`assessPositionConsensus`, en az iki farklı kaynak kimliğinden gelen güncel mevkilerin WGS84 ayrışmasını ölçer. Kaynaklar belirlenen sınırı aşarsa veya seçilmiş ana mevki yoksa `HOLD` döner. Yakın sonuçları ortalamaz; açıkça seçilmiş ana kaynağı korur ve diğerlerini yalnız çapraz kontrol için kullanır.

## Açık birimli nicelikler

Yeni güvenli nicelik API'si çıplak sayıları kabul etmez. Mesafe, hız, süre ve açı `{ value, unit }` olarak verilir; desteklenen birimler doğrulanıp `NM`, `kn`, `h` ve `deg` kanonik birimlerine çevrilir. Böylece metre/deniz mili veya saniye/saat karışıklığı sessizce hesaba giremez.

## Teslim denetimi

```powershell
npm run verify
```

Bu komut gerekli teslim dosyalarını ve API yüzeyini denetler, bütün testleri çalıştırır ve örnek entegrasyonu yürütür. API sözleşmesi için `docs/API.md`, gerçek kapsam ve kalan sınırlar için `docs/SCOPE_AND_LIMITS.md`, hata/tehdit kontrolleri için `docs/THREAT_MODEL.md` esas alınır.

## Güvenlik sınırı

Bu motorun çıktıları eğitim/araştırma amaçlıdır. Kaynak ve tolerans doğrulaması tamamlanmadan gerçek gemi operasyonunda karar otoritesi olarak kullanılmaz.
