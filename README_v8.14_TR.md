# Sinbad Marine v8.14.0 — Users, Roles & Library Submissions

## Kurulum sırası

1. Supabase SQL Editor'da `MIGRATION_006A_ROLES.sql` dosyasını tek başına çalıştırın.
2. Başarılı olunca yeni sorguda `MIGRATION_006B_SUBMISSIONS_RLS.sql` dosyasını çalıştırın.
3. Yeni sorguda `MIGRATION_006C_VERIFY.sql` dosyasını çalıştırın.
4. Ali Kaptan için `developer`, Kerim için `visitor` sonucu görünmelidir.
5. ZIP içindeki bütün web dosyalarını GitHub deposunun ana dizinine yükleyip Commit yapın.

## Roller

- Owner/Administrator/Captain: gönderimleri inceler, onaylar veya reddeder.
- Developer: özgün kaynakları yalnızca karantina alanına gönderir.
- Visitor: onaylanmış standart içerikleri ve izin verilen uygulama özelliklerini kullanır; belge yükleyemez, değiştiremez veya silemez.

## Belge güvenlik akışı

Developer yüklemesi `quarantine` bucket'ına gider ve `submitted` durumunda kalır. Owner onayı yalnızca durumu `approved_pending_scan` yapar. Dosya otomatik yayımlanmaz. Güvenilir zararlı dosya tarayıcısı kurulup başarı sonucu üretmeden ana arşive taşıma yapılmaz.

Özgün kaynak ileride doğal biçimiyle özel kaynak arşivinde korunacak; OCR/metin ve Sinbad bilgi parçaları ayrı türetilmiş kayıtlar olarak tutulacaktır.

## Değişmeyenler

v8.13.0'daki intro, yönetim ekranı, Cloud, konum, kamera, Captain's Logbook ve Voice Watch korunmuştur.
