# Atlas Marine OS v8.9 — Cinematic World Chart

Bu sürüm v8.8 Integrated Management temelini korur ve güvenli giriş ekranından önce sinematik bir açılış oynatır.

## Sinematik açılış

- Samanyolu ve yıldız alanı
- Uzaktan yaklaşan, kendi ekseninde dönen Dünya
- Dünya’nın dalgalanarak Maritime World Chart’a açılması
- Atlas Marine OS marka finali
- Skip Intro ve tekrar oynatma
- Cihazın “hareketi azalt” tercihine uyum

Harita açılış görselidir; seyir veya navigasyon amacıyla kullanılamaz.

Atlas Marine OS v8.9, güvenli Atlas Cloud giriş kapısını tam yönetim uygulamasıyla tek sürümde birleştirir.

## Girişten sonra açılan modüller

- Dashboard
- Cloud Document Center
- Nautical Publications
- Nautical Charts
- Fleet Manager
- Crew Manager
- Pilot Library
- Route Library
- Knowledge Center
- Captain Sinbad
- Atlas Cloud Control Center

## Güvenli erişim

Oturum açmamış ziyaretçiler yalnızca İngilizce “under development” sayfasını görür. Mevcut geçerli Supabase oturumu olan kullanıcı doğrudan yönetim uygulamasına alınır.

Şifre kurtarma ekranı e-postayla gönderilen 8 haneli kodu kabul eder. Yeni şifre en az 8 karakter olmalıdır.

Supabase Project URL ve publishable key önceki v8.x sürümünden otomatik olarak okunur. Secret key veya service-role key tarayıcıya yazılmamalıdır.

## Kurulum

ZIP içindeki bütün dosyaları GitHub `atlas-marine-os` deposunun ana dizinine yükleyin ve mevcut dosyaların üzerine yazılmasına izin verin. Commit sonrasında eski site sekmesini kapatıp yeniden açın. Sağ üstte `v8.8` görünmelidir.

## Ürün yönetimi

Bu sürüm [OWNER_GOVERNANCE.md](OWNER_GOVERNANCE.md) içindeki Owner Approval Rule’a tabidir. Kaptan Varol Çolak’ın açık onayı olmadan çalışan özellik kaldırılamaz ve yönetim uygulaması web girişinden ayrılamaz.
