# Güvenli API sözleşmesi

Bu belge `sinbad-navigation-engine` paketinin `0.2.x` CommonJS API sözleşmesini tanımlar. Ana giriş `require("sinbad-navigation-engine")` veya repo içinde `require(".")` biçimindedir.

## Jeodezi

- `EARTH_MODELS`: `SPHERE`, `WGS84` sabitleri.
- `inverseRoute({ earthModel, lat1, lon1, lat2, lon2 })`: mesafe ve iki uçtaki ileri azimut.
- `directRoute({ earthModel, lat, lon, initialCourse, distanceNm })`: başlangıç, azimut ve mesafeden hedef mevki.
- `compareEarthModels({ lat1, lon1, lat2, lon2 })`: küresel ve WGS84 sonuç farkı.

`earthModel` sessiz varsayılan taşımaz. `SPHERE` yaklaşık eğitim hesabıdır. `WGS84` GeographicLib geodesic uygulamasını kullanır.

## Rota planı ve bütünlük

- `validateRoutePlan(plan)`: kimlik, ad, Dünya modeli ve en az iki koordinatlı waypoint doğrular.
- `calculateRoutePlan(plan)`: bacak mesafeleri/azimutları ve toplam mesafeyi üretir.
- `createRouteRevision(options)`: SHA-256 zincirli rota revizyonu oluşturur.
- `verifyRouteRevision(revision)`: tek revizyon bütünlüğünü doğrular.
- `verifyRevisionChain(revisions)`: sıra ve önceki-hash bağlarını doğrular.

Revizyon hash’i elektronik imza değildir.

## Doğrulama ve yayın

- `verifyInverseAgainstReference(calculated, reference, tolerances)`: kimlikli harici referansla karşılaştırır; `PASS` veya `HOLD`.
- `verifyDirectInverseClosure(request, tolerances)`: yalnız iç tutarlılık kontrolüdür.
- `assessRouteRelease({ revisions, legEvidence, approval })`: `HOLD`, `READY_FOR_HUMAN_APPROVAL` veya `RELEASED`.

`RELEASED`, yalnız yazılım içindeki açık insan karar kaydıdır; yasal/klas/bayrak/ECDIS onayı değildir.

## Girdi kalitesi

- `SOURCE_TYPES`: `LIVE_SENSOR`, `LIVE_SERVICE`, `MANUAL_OBSERVATION`, `STATIC_PUBLICATION`.
- `assessInputProvenance(input, options)`: kaynak, edisyon/zaman ve güncellik kontrolü.
- `assessInputSet(inputs, policies, options)`: gereken girdileri birlikte değerlendirir.
- `assessPositionConsensus(observations, options)`: bağımsız mevkilerin WGS84 ayrışmasını denetler.

## Birimler

- `quantities.distance`, `speed`, `duration`, `angle`, `convert`.
- `calculateDistanceRun(speed, duration)`.

Güvenli nicelik API’si `{ value, unit }` ister. Kanonik birimler `NM`, `kn`, `h`, `deg` biçimindedir.

## Eski API

`spherical`, başlangıç snapshot’ındaki geniş fonksiyon koleksiyonudur. Davranış uyumluluğu için korunur; yeni entegrasyonların güvenli üst seviye API’yi kullanması gerekir. Eski fonksiyonların her biri otorite fixture seviyesinde doğrulanmış sayılmaz.
