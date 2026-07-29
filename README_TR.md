# Atlas Marine OS v8.6 — Sprint 1 Test

Bu sürüm yalnızca çalışan Atlas Cloud çekirdeğine odaklanır:

- Supabase bağlantısını kaydetme
- E-posta/şifre ile oturum açma ve çıkış
- Şifremi unuttum ve güvenli şifre yenileme akışı
- Yetkili workspace seçimi
- `atlas-documents` private bucket’ına en fazla 10 MB PDF yükleme
- `documents` tablosuna metadata kaydı
- Dosyaları listeleme
- 60 saniyelik signed URL ile açma ve indirme
- Storage nesnesiyle metadata kaydını birlikte yeniden adlandırma
- Storage nesnesini ve metadata kaydını silme

## GitHub Pages kurulumu

Bu klasördeki dosyaların tamamını GitHub deposunun ana dizinine yükleyin. Aynı isimli eski dosyaların üzerine yazılmasına izin verip Commit changes yapın.

Eski sürüm görünürse:

1. Atlas Marine OS’nin açık Safari sekmelerini kapatın.
2. Siteyi yeniden açın.
3. Sağ üstte `v8.6 TEST` yazdığını kontrol edin.

## İlk bağlantı

Uygulamada yalnızca şu iki değer kullanılır:

- Supabase Project URL
- Supabase publishable key veya eski anon key

Database parolası, secret key, service-role key ve OpenAI anahtarı uygulamaya kesinlikle girilmez.

## Şifre kurtarma

Supabase `Authentication → URL Configuration` bölümünde hem Site URL hem de izin verilen Redirect URL olarak şu adres bulunmalıdır:

`https://varolcolak2013-stack.github.io/atlas-marine-os/`

Giriş kartındaki `Şifremi unuttum` bağlantısı kurtarma e-postası gönderir. v8.6, posta servislerinin tek kullanımlık bağlantıları önceden tarayıp tüketmesine karşı e-postadaki 8 haneli OTP kodunu kullanır. Kod uygulamada doğrulandıktan sonra yeni şifre ekranı açılır.

v8.6 kullanılmadan önce `SUPABASE_RECOVERY_TEMPLATE_TR.md` dosyasındaki Reset Password e-posta şablonu Supabase Dashboard’a kaydedilmelidir.

## Gereken mevcut altyapı

Bu paket, daha önce kurduğunuz şu yapıyı bekler:

- `workspaces`
- `workspace_members`
- `documents`
- private `atlas-documents` bucket
- ilgili Database ve Storage RLS policies
- dosya yolunun ilk bölümünde workspace UUID kontrolü

Yüklenen nesne yolu:

`<workspace_uuid>/documents/<random_uuid>/<filename.pdf>`

## Bilinen sınırlar

- Bu bir Sprint 1 test sürümüdür; yalnızca PDF kabul eder.
- Dosya başına uygulama sınırı 10 MB’dir.
- Yeni kullanıcı oluşturma ve şifre sıfırlama bu sürümde yoktur.
- Aynı anda çoklu dosya yükleme yoktur.
- Captain Sinbad ve yeni modüller özellikle eklenmemiştir.
- Supabase bağlantı değerleri cihazdaki tarayıcıda saklanır. Bunlar yalnızca publishable değerler olmalıdır.
