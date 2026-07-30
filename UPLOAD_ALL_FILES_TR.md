# Sinbad Marine v8.12.0

Bu paket intro ile yönetim uygulamasını tekrar tek sürümde birleştirir.

GitHub deposunun ana dizinine bu paketteki bütün dosyaları birlikte yükleyin ve
mevcut dosyaların değiştirilmesine izin verin. Klasör oluşturmayın.

Canlı kontrol:

https://varolcolak2013-stack.github.io/atlas-marine-os/?device=8120

Beklenen akış:

1. Sinematik intro ve kuzgunlu Sinbad görünür.
2. Giriş kapısı açılır.
3. Captain Sign In ile oturum açılır.
4. Giriş başarılı olunca tam yönetim paneli görünür.
5. Aynı Supabase hesabıyla Windows ve iPhone aynı Atlas Cloud sistemine bağlanır.
6. Location Intelligence yalnızca kullanıcı düğmeye bastığında konum izni ister.
7. Camera & Media Archive yalnızca kullanıcı düğmeye bastığında kamera izni ister.
8. Çekilen medya Upload düğmesine basılmadan buluta gönderilmez.
9. İlk medya arşivi `passage-media/private-media` altında restricted olarak saklanır.

Project URL ve publishable key cihazdan cihaza yeniden girilmez. Şifre ve gizli
anahtarlar hiçbir zaman paket içinde saklanmaz.

Telefon testi için Safari/Chrome ayarlarında siteye kamera ve konum izni verin.
Konum ve kamera servisleri yalnızca HTTPS üzerinden çalışır; GitHub Pages adresi
bu şartı karşılar.
