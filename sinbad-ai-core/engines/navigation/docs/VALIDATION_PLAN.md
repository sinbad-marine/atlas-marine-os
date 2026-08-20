# Navigation Engine Validation Plan

## Kanıt seviyeleri

1. **Unit:** Fonksiyonun tanımlı örnekte beklenen sonucu vermesi.
2. **Property:** Tersinirlik, sınırlar, monotonluk ve birim özellikleri.
3. **Cross implementation:** Bağımsız ve güvenilir uygulama ile tolerans içinde karşılaştırma.
4. **Authority fixture:** Resmî kurumun yayımladığı örnek/veri setiyle doğrulama.
5. **Operational domain:** Yöntemin geçerli olduğu aralığın ve belirsizliğin belgelenmesi.

Başlangıç snapshot'ındaki 109 test ağırlıklı olarak seviye 1 ve kısmen seviye 2 kanıtıydı. `0.2.0` teslimi ayrıca WGS84 otorite fixture'ı, tolerans kapıları, provenans, revizyon, yayın ve girdi güvenliği testlerini içerir. Güncel sayı için `npm run verify` çıktısı esas alınır. Eski formüllerin tamamı için seviye 3–5 tamamlanmadan geniş operasyonel doğruluk iddiası kurulamaz.

## Öncelikli doğrulama kaynakları

| Alan | Birincil kaynak | Kullanım |
|---|---|---|
| WGS-84 inverse/forward geodesic | NOAA NGS INVERSE/FORWARD | Mesafe ve azimut golden sonuçları |
| Ellipsoidal geodesic/rhumb | GeographicLib test setleri ve kaynak uygulama | Kutup/antipodal/antimeridyen çapraz doğrulama |
| Great-circle ve Mercator sailing | NGA Maritime Safety Information calculators ve Bowditch | Denizcilik örnekleri ve işaret kuralları |
| Geodesic/rhumb çizim doğruluğu | IHO S-64 test veri setleri | Hat/waypoint ve meridyen geçişleri |
| UKC | IHO S-129 | Veri modeli, kalite ve güvenlik kapıları |
| Su seviyesi/akıntı | IHO S-104/S-111 ve NOAA CO-OPS | Tarihli veri ile harmonik/ürün sonuçları |

## İlk bulgu: küresel ve elipsoidal hesap ayrımı

Mevcut `greatCircleInverse` ve `greatCircleDestination`, sabit `R_NM = 3440.065` ile küresel trigonometri kullanır. NOAA NGS INVERSE/FORWARD ise WGS-84/GRS80 elipsoidi üzerinde jeodezik çözüm üretir.

Bu nedenle API şu ayrımı açıkça taşımalıdır:

- `sphericalGreatCircle*`: hızlı/eğitim amaçlı küresel çözüm
- `wgs84Geodesic*`: elipsoidal ve bağımsız referansla doğrulanmış çözüm

Eski fonksiyon adları geriye uyumluluk döneminde deprecate edilmeli; sessizce anlam değiştirilmemelidir.

## Golden fixture şeması

```json
{
  "case_id": "NGS-GEODESIC-001",
  "method": "wgs84-inverse",
  "source": {
    "authority": "NOAA National Geodetic Survey",
    "title": "INVERSE/FORWARD",
    "url": "https://geodesy.noaa.gov/TOOLS/Inv_Fwd/Inv_Fwd.html"
  },
  "inputs": {},
  "expected": {},
  "tolerance": {},
  "units": {},
  "notes": ""
}
```

## İlk test sırası

1. Çakışık noktalar
2. Ekvator üzerinde doğu/batı
3. Aynı meridyen üzerinde kuzey/güney
4. Greenwich geçişi
5. Antimeridyen geçişi
6. Kutuplara yakın rota
7. Neredeyse antipodal noktalar
8. Kısa mesafe liman yaklaşması
9. Okyanus geçişi
10. Direct → inverse round trip

Her testte mesafe, başlangıç/son azimut, normalizasyon, birim ve tolerans ayrı doğrulanmalıdır.
