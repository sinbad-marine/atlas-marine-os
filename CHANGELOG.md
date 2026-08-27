# Sinbad Marine değişiklik günlüğü

Bu dosya yalnız doğrulanmış depo değişikliklerini özetler. Sürüm ve yayın iddiaları test kanıtından ayrı değerlendirilmelidir.

## Yayınlanmamış

### Güvenlik ve güvenilirlik

- Eski expert kayıtlarındaki `execute` alanı sözleşme seviyesinde fail-closed reddedilir; expert registry plan-only kalır.
- Academy tahta komutları benzersiz istek kimliği, sınırlı FIFO kuyruk, zaman aşımı ve uygulandı onayı kullanır.
- Sinbad, Academy işlemi doğrulanmadan işlemin tamamlandığını söylemez.
- Tahta soru/cevap akışı yalnız doğrulanmış şekil ve sabit cevap anahtarı üzerinden çalışır.

### Canlı Sinbad karakter motoru

- Konuşma, dinleme, düşünme, öğretme ve düzeltme durumları için sınırlı 2B hareket akışları eklendi.
- Bağlama uygun hareket çeşitliliği tekrar etmeyen sınırlı seçim torbalarıyla sağlandı.
- Academy penceresinde yazma, izinli şekil çizme, silme ve tahtaya yönelme kareleri eklendi.
- Reduced-motion tercihi ve kesilebilir performans dizileri korundu.

### Kumanda paneli ve bağımsız modül pencereleri

- Ana sayfa yalnız kumanda paneli olarak tutuldu; çalışma alanları artık panelin altında açılmaz.
- Captain Sinbad ve diğer panel modülleri ayrı, yeniden boyutlandırılabilir tarayıcı pencerelerinde açılır.
- Her modül penceresinin son boyut ve konumu cihazda ayrı ayrı saklanır.
- Modül pencerelerinin sağ üstüne küçük yatay bir grupta kompakt görünüm, önceki ölçüye dönüş, ekran alanına büyütme ve gerçek tam ekran kontrolleri eklendi.

### Doğrulama

- Expert callback kilidi sonrası tam Node regresyonu: 755 test, 754 geçti, 0 hata, 1 bilinçli atlama.
- Academy ACK değişikliği sonrası Chromium masaüstü/mobil paketi: 18/18 geçti.
- Bağımsız modül penceresi değişikliği sonrası tam Node regresyonu: 848 test, 847 geçti, 0 hata, 1 bilinçli atlama.
- Chromium masaüstü/mobil yayın paketi: 28/28 geçti; Sinbad ve filo modüllerinin panelden bağımsız açılması doğrulandı.

## Bilinen sınırlar

- Karakter motoru çalışan 2B katmanlı rig ve performans motorudur; film kalitesinde tam 3B dijital insan değildir.
- Gerçek gemi kumandası, safety-critical aktüatör yetkisi ve sertifikasyon iddiası yoktur.
- Push, PR ve canlı yayın bu kayıtların parçası değildir; ayrıca yetkilendirilip doğrulanmalıdır.
