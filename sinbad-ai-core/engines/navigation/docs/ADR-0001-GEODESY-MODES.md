# ADR-0001: Küresel ve WGS-84 Elipsoidal Seyir Modları

- Durum: Kabul edildi
- Tarih: 2026-08-20

## Bağlam

Başlangıç motoru great-circle hesaplarını sabit yarıçaplı küre üzerinde yapmaktadır. Bu yöntem klasik seyir eğitimi ve hızlı yaklaşık hesaplar için değerlidir; ancak WGS-84 elipsoidal jeodeziyle aynı sonuçları verdiği iddia edilemez.

## Karar

Küresel hesaplar açık isim ve metadata ile korunacaktır. Ayrı bir WGS-84 elipsoidal geodesic modülü geliştirilecek ve NOAA NGS/GeographicLib/IHO testleriyle doğrulanacaktır.

Her sonuç en az şu metadata alanlarını taşıyacaktır:

- `method`
- `earthModel`
- `units`
- `sourceVersion`
- `validationStatus`
- `warnings`

## Sonuçlar

- Eski eğitim örnekleri bozulmadan korunabilir.
- Hassas rota hesabı için ayrı kalite kapısı oluşur.
- Kullanıcı, yaklaşık ve elipsoidal sonucu karıştıramaz.
- Ayrı WGS-84 uygulaması eklenmiştir; eski küresel fonksiyonlar yine operasyonel elipsoidal hassasiyet iddiası taşımaz.
