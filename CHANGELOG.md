# Changelog

## v8.4 Test — Sprint 1

- Şifre kurtarma sonuçları modalın içinde kalıcı olarak gösteriliyor.
- Hata mesajları artık otomatik kaybolmuyor.
- Supabase 429/e-posta limiti Türkçe ve uygulanabilir açıklamayla gösteriliyor.
- Yetkisiz e-posta ve ağ hataları anlaşılır mesajlara dönüştürüldü.
- Başarılı istekten sonra ikinci kez yanlışlıkla gönderim engelleniyor.

## v8.3 Test — Sprint 1

- Kurtarma isteği cihazda iki saat süreyle güvenli bir durum işareti olarak tutuluyor.
- `PASSWORD_RECOVERY`, `SIGNED_IN`, authorization code ve access-token callback biçimleri destekleniyor.
- Eski kurtarma e-postalarının karıştırılmaması için ek uyarı eklendi.
- Başarısız e-posta gönderiminde geçici kurtarma işareti temizleniyor.
- Şifre başarıyla yenilendiğinde recovery durumu ve URL bilgileri temizleniyor.

## v8.2 Test — Sprint 1

- “Şifremi unuttum” bağlantısı eklendi.
- Kurtarma e-postası Atlas Marine OS’nin mevcut yayın adresine yönlendiriliyor.
- Supabase `PASSWORD_RECOVERY` oturumu otomatik tanınıyor.
- Yeni şifre belirleme ve doğrulama ekranı eklendi.
- Şifre yenilendikten sonra oturum güvenli biçimde kapatılıp normal giriş isteniyor.

## v8.1 Test — Sprint 1

- Cloud-first çekirdek temiz biçimde yeniden kuruldu.
- Supabase bağlantı ve oturum akışı birbirinden ayrıldı.
- Workspace üyelikleri mevcut RLS şemasından okunuyor.
- PDF yükleme yolu Storage workspace güvenlik kuralına uyarlandı.
- Başarısız metadata kaydında yüklenen Storage nesnesi geri alınıyor.
- Private dosyalar kısa süreli signed URL ile açılıyor ve indiriliyor.
- Yeniden adlandırma Storage move ve metadata update olarak birlikte yürütülüyor.
- Silme hem Storage hem Database üzerinde uygulanıyor.
- iPad için görünür durum, hata ve yükleme geri bildirimleri eklendi.
- Yeni modül eklenmedi.
