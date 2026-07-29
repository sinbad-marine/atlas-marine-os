# Atlas Marine OS v8.7 — Canlı Test Kontrol Listesi

Testi normal Safari sekmesinde yapın. Her adım başarılı olmadan sonraki adıma geçmeyin.

## A. Sürüm ve bağlantı

- [ ] Sağ üstte `v8.7 TEST` görünüyor.
- [ ] Oturum yokken yalnızca İngilizce “under development” ekranı görünüyor.
- [ ] `Captain Sign In` düğmesi yetkili giriş ekranını açıyor.
- [ ] Supabase Project URL girildi.
- [ ] Publishable/anon key girildi.
- [ ] “Bağlantıyı kaydet” sonrasında başarı mesajı göründü.
- [ ] Durum göstergesi “Sign in required” oldu.

## B. Oturum

- [ ] Kayıtlı kullanıcı e-postası ve şifresiyle giriş yapıldı.
- [ ] Kullanıcı e-postası yeşil oturum kartında göründü.
- [ ] Çıkış düğmesi göründü.

## B2. Şifre kurtarma

- [ ] “Şifremi unuttum” ekranı açıldı.
- [ ] Kayıtlı e-posta için kurtarma mesajı gönderildi.
- [ ] E-postadaki 8 haneli kod Atlas Marine OS’ye girildi.
- [ ] Kod doğrulandıktan sonra “Yeni şifre” ekranı açıldı.
- [ ] En az 10 karakterli yeni şifre kaydedildi.
- [ ] Yeni şifreyle normal giriş yapılabildi.

## C. Workspace

- [ ] `Atlas Marine Technologies` listede göründü.
- [ ] Workspace seçildi.
- [ ] Rol `owner` olarak göründü.
- [ ] Üst durum “Atlas Cloud ready” oldu.

## D. Küçük PDF yükleme

- [ ] 10 MB’den küçük bir test PDF seçildi.
- [ ] Yükleme göstergesi göründü ve sonra kapandı.
- [ ] Başarı mesajı göründü.
- [ ] Dosya listede adı, boyutu ve tarihiyle göründü.
- [ ] Supabase Storage içindeki `atlas-documents` bucket’ında dosya oluştu.
- [ ] Supabase `documents` tablosunda metadata satırı oluştu.

## E. Dosya işlemleri

- [ ] “Aç” PDF’i yeni sekmede açtı.
- [ ] “İndir” PDF indirmesini başlattı.
- [ ] “Adlandır” dosya adını değiştirdi.
- [ ] Yenilemeden sonra yeni ad listede kaldı.
- [ ] “Sil” onay istedi.
- [ ] Onay sonrasında dosya listeden kayboldu.
- [ ] Storage nesnesi ve `documents` kaydı silindi.

## F. Hata testleri

- [ ] PDF olmayan dosya reddedildi.
- [ ] 10 MB’den büyük PDF açık mesajla reddedildi.
- [ ] Hatalı şifre anlaşılır mesaj gösterdi.
- [ ] İnternet kapatılınca çevrimdışı uyarısı göründü.
- [ ] Sayfa yenilendiğinde oturum ve bağlantı korundu.

## Hata bildirimi

Bir adım çalışmazsa şu bilgileri kaydedin:

- Test maddesi:
- Ekrandaki hata:
- Dosya adı ve boyutu:
- iPad/iOS sürümü:
- Safari normal veya Private:
- Ekran görüntüsü:
