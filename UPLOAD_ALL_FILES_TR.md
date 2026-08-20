# Sinbad Marine v8.20.8 — Core Gate Yayın Sırası

Bu paket Captain Sinbad'ın yerel uzman, bulut AI ve web-arama yollarını
`DECISION_SUPPORT_ONLY` Core güvenlik kapısına bağlar. Uygulama, Core asset'i
ve service-worker cache anahtarı aynı `v8.20.8` sürümünü taşır.

GitHub deposunun ana dizinine bu paketteki bütün dosyaları birlikte yükleyin ve
mevcut dosyaların değiştirilmesine izin verin. Klasör oluşturmayın.

Canlı adresi repo ayarındaki GitHub Pages kaynağından doğrulayın. Eski test
adresleri veya query-string sürümleri yayın kanıtı sayılmaz.

## Zorunlu yayın sırası

1. Supabase `sinbad-answer` Edge Function'ını deploy edin.
2. Edge Function'ın eksik veya değiştirilmiş `coreEnvelope` isteğini
   `CORE_GATE_BLOCKED` ile reddettiğini doğrulayın.
3. Geçerli isteğin `permission: DECISION_SUPPORT_ONLY` ve
   `executionPerformed: false` döndürdüğünü doğrulayın.
4. Bundan sonra GitHub Pages statik paketini yayınlayın.
5. Eski service worker'ı kapatıp yeniden açarak ekranda `v8.20.8` görüldüğünü
   doğrulayın.

Statik web paketi Edge Function'dan önce yayınlanırsa istemci eski Edge
cevabını fail-closed reddeder; bulut AI geçici olarak kullanılamaz. Bu durum
güvenlik kapısını gevşeterek aşılmamalıdır.

Beklenen akış:

1. Sinematik intro ve Sinbad görünür.
2. Giriş kapısı açılır.
3. Captain Sign In ile oturum açılır.
4. Giriş başarılı olunca tam yönetim paneli görünür.
5. Aynı Supabase hesabıyla Windows ve iPhone aynı Atlas Cloud sistemine bağlanır.
6. Location Intelligence yalnızca kullanıcı düğmeye bastığında konum izni ister.
7. Camera & Media Archive yalnızca kullanıcı düğmeye bastığında kamera izni ister.
8. Çekilen medya Upload düğmesine basılmadan buluta gönderilmez.
9. İlk medya arşivi `passage-media/private-media` altında restricted olarak saklanır.
10. Captain Sinbad seyir hesabını yalnız karar desteği olarak gösterir.
11. Bulut ve izinli web cevapları Core karar etiketi olmadan gösterilmez.

Project URL ve publishable key cihazdan cihaza yeniden girilmez. Şifre ve gizli
anahtarlar hiçbir zaman paket içinde saklanmaz.

Telefon testi için Safari/Chrome ayarlarında siteye kamera ve konum izni verin.
Konum ve kamera servisleri yalnızca HTTPS üzerinden çalışır; GitHub Pages adresi
bu şartı karşılar.
