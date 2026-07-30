# Sinbad Marine v8.14.1 — Davet ve Üyelik Düzeltmesi

Bu sürüm v8.14.0 yönetim sistemi, roller, Library Submissions, Captain’s
Logbook, konum, kamera ve Atlas Cloud özelliklerini aynen korur.

## Eklenen güvenli giriş akışları

- Ziyaretçi sayfasında görünür **Member Sign In** düğmesi
- Görünür **Create Account** düğmesi
- E-posta ve şifreyle normal giriş
- E-posta doğrulamalı yeni hesap oluşturma
- Supabase davet bağlantısından gelen kullanıcı için otomatik
  **Complete Your Invitation** ekranı
- Davet edilen kullanıcının adını ve ilk şifresini oluşturması
- Mevcut 8 haneli şifre kurtarma sistemi

## Yetki güvenliği

Yeni hesap oluşturmak özel çalışma alanı erişimi vermez. Kullanıcının özel
workspace erişimi için Kaptan Varol Çolak’ın daveti veya onayı gerekir.
Davet edilen kullanıcının `developer` veya `visitor` rolü Supabase RLS
politikaları tarafından uygulanmaya devam eder.

## GitHub yükleme

ZIP’i açın ve içindeki bütün web dosyalarını `atlas-marine-os` deposunun ana
dizinine yükleyip **Commit changes** yapın. Özel Supabase SQL paketlerini web
deposuna yüklemeyin.

