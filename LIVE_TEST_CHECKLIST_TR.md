# Sinbad Marine — Canlı test kontrol listesi

Bu liste kontrollü yayın öncesinde gerçek ortamda insan tarafından uygulanır. Otomatik testlerin geçmesi tek başına production veya sertifikasyon onayı değildir.

## 1. Yayın kimliği

- [ ] Beklenen commit ve dal kaydedildi.
- [ ] Commit edilmemiş dosyalar raporlandı.
- [ ] Yayın URL'si, zaman damgası ve geri dönüş commit'i kaydedildi.
- [ ] Tarayıcı konsolunda beklenmeyen hata yok.

## 2. Dil ve görünüm

- [ ] Türkçe ve İngilizce metinlerde bozuk karakter yok.
- [ ] Masaüstü ve mobil görünümde taşma veya kapanma yok.
- [ ] Klavye odağı ve temel ekran okuyucu etiketleri çalışıyor.
- [ ] Reduced-motion tercihinde gereksiz hareket devre dışı.

## 3. Sinbad karakteri

- [ ] Konuşma, dinleme ve düşünme durumları görünür ve sonlu.
- [ ] Yeni kullanıcı komutu devam eden hareketi güvenle kesiyor.
- [ ] Hareket ve sözlü açıklama birbiriyle tutarlı.
- [ ] Desteklenmeyen fiziksel eylem yapılmış gibi bildirilmiyor.

## 4. Academy ve canlı tahta

- [ ] Academy ayrı pencerede açılıyor.
- [ ] Yazı ve izinli şekiller tahtada gerçekten görünüyor.
- [ ] Yazma, çizme ve silme hareketlerinin ara kareleri görülüyor.
- [ ] İşlem onayı gelmeden Sinbad başarı mesajı vermiyor.
- [ ] Hatalı, gecikmiş veya eski ACK sonraki komutu doğrulamıyor.
- [ ] Tahta kuyruğu sıralı çalışıyor ve kapasite aşımında fail-closed davranıyor.
- [ ] Soru, ipucu, cevap ve “neden” akışı yalnız doğrulanmış tahta içeriğine dayanıyor.

## 5. Core güvenlik sınırı

- [ ] `execute` alanı taşıyan expert kaydı reddediliyor.
- [ ] Expert registry ve grounded orchestrator plan-only kalıyor.
- [ ] Kaynaksız veya çelişkili bilgi kesin sonuç olarak sunulmuyor.
- [ ] Navigasyon/operasyon yetkisi ve aktüatör komutu üretilmiyor.

## 6. Atlas Cloud ve çevrimdışı davranış

- [ ] Yetkisiz kullanıcı özel workspace içeriğini göremiyor.
- [ ] Tenant/workspace sınırları gerçek iki hesapla doğrulandı.
- [ ] Ağ kesintisinde açık hata veya doğrulanmış çevrimdışı davranış görülüyor.
- [ ] Yeniden bağlantıda veri kaybı veya sessiz çift kayıt oluşmuyor.

## 7. Otomatik kanıt

- [ ] `npm test -- --test-reporter=dot` hatasız.
- [ ] `npx playwright test tests/browser/release-quality.spec.js --reporter=line` hatasız.
- [ ] Test sayıları, commit kimliği ve tarih kanıt paketine yazıldı.
- [ ] Testler commit edilmemiş değişikliklerle çalıştıysa bu açıkça belirtildi.

## Sonuç

- [ ] GO — tüm zorunlu maddeler geçti.
- [ ] NO-GO — en az bir zorunlu madde başarısız veya kanıtsız.

Notlar / bulgular:

```text

```
