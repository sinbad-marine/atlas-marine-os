# Sinbad Marine v8.13.0 — Captain's Logbook

Bu sürüm v8.12.0'ın çalışan yönetim, bulut, konum, kamera ve sinematik intro özelliklerini korur.

## Yeni özellikler

- Captain's Logbook taslak jurnal arşivi
- Uygulama açıkken çalışan Sinbad Voice Watch
- “Sinbad Log …” sesli komutu
- Push to Talk yedeği
- Yerel saat, UTC, kategori ve isteğe bağlı konum
- Taslak, incelendi ve resmi jurnale aktarıldı durumları
- Düzenleme ve silme
- JSON ve CSV yedek alma
- Mikrofonla ayrı ses notu kaydı
- Görünür ve kullanıcı tarafından başlatılan acil durum ses/video kaydı

## Önemli sınırlar

- Taslak kayıtlar resmi/gemi jurnalinin yerine geçmez. Kaptan veya yetkili zabit tarafından kontrol edilip resmi jurnale aktarılmalıdır.
- Tarayıcı uygulama kapalıyken veya telefon kilitliyken güvenilir biçimde “Sinbad” kelimesini dinleyemez.
- Voice Watch yalnızca kullanıcı düğmeyle başlattığında ve uygulama açıkken çalışır.
- Acil kayıt hiçbir kişiye veya servise otomatik gönderilmez.
- Bu özellik GMDSS, DSC, VHF veya resmi acil yardım kanallarının yerine geçmez.
- Ses tanıma desteği tarayıcıya göre değişir. Destek yoksa yazılı giriş ve ses kaydı kullanılabilir.

## Kurulum

ZIP içindeki tüm dosyaları GitHub deposunun ana dizinine yükleyin ve mevcut dosyaların üzerine yazın. Commit sonrasında eski sekmeleri kapatın ve siteyi yeniden açın. Sağ üstte `v8.13.0` görünmelidir.

## Veri saklama

Metin taslakları bu sürümde cihazın tarayıcı depolamasında saklanır. JSON/CSV dışa aktarma ile düzenli yedek alınmalıdır. Bulut jurnal senkronizasyonu, ayrı veritabanı migration'ı ve RLS testi tamamlandıktan sonra etkinleştirilecektir.
