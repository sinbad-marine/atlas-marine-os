# Sinbad Marine v8.15.8 — Bağlantı Teşhisi

Bu sürüm, halka açık başlangıç ekranına **Check Cloud Connection**
düğmesini ekler. Giriş yapılmadan önce Supabase bağlantısı ve publishable
key doğrulanır; hata mesajı kullanıcı okuyana kadar ekranda kalır.

Bu güncelleme introsuz açılışı korur ve Atlas Cloud proje adresindeki tek harflik hatayı düzeltir.

- Uygulama artık doğrudan ziyaretçi/giriş ekranına açılır.
- Oturumu açık yetkili kullanıcı doğrudan yönetim uygulamasına erişir.
- Captain Sign In, üyelik, workspace, dosya yönetimi ve diğer mevcut özellikler korunmuştur.
- Eski intro dosyaları ve görselleri silinmez; yalnızca uygulama tarafından yüklenmez.
- Supabase istekleri artık çevrimdışı önbellek tarafından ana sayfaya yönlendirilmez.
- Bağlantı kesintilerinde anlaşılır bir Atlas Cloud hata mesajı gösterilir.
- Eski sürümde kaydedilen hatalı `...tegm...` adresi otomatik olarak doğru `...teqm...` adresine çevrilir.

## GitHub'a yükleme

Depodaki mevcut dosyaların üzerine yalnızca şu üç dosyayı yükleyin:

1. `index.html`
2. `app.js`
3. `sw.js`

Ardından **Commit changes** yapın. Yayın güncellendikten sonra siteyi şu adresle açın:

`https://varolcolak2013-stack.github.io/atlas-marine-os/?v=8158`

Gerekirse eski sekmeyi kapatıp yeni bir sekmede tekrar açın.
