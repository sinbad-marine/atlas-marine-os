# Atlas Marine OS v8.10 — NASA Cinematic World Chart

Bu sürüm v8.8 Integrated Management temelini korur ve güvenli giriş ekranından önce yaklaşık 18 saniyelik, NASA görsellerine dayanan sinematik bir açılış oynatır.

## Sinematik açılış

- NASA Deep Star Map tabanlı Samanyolu ve yıldız alanı
- NASA Blue Marble tabanlı, atmosferli ve kendi ekseninde dönen Dünya
- Dünya’nın dalgalanarak Maritime World Chart’a açılması
- Gerçek kıta ve kıyı çizgileri üzerinde denizcilik ızgarası
- Açılıştan sonra beliren hareketli altın dünya rotaları
- Atlas Marine OS marka finali
- Skip Intro ve tekrar oynatma
- Cihazın “hareketi azalt” tercihine uyum

NASA görselleri NASA/Goddard Space Flight Center Scientific Visualization Studio kaynaklıdır. Harita açılış görselidir; seyir veya navigasyon amacıyla kullanılamaz.

Atlas Marine OS v8.10, güvenli Atlas Cloud giriş kapısını tam yönetim uygulamasıyla tek sürümde birleştirir.

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
