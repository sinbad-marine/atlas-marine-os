# Sinbad Asistan — İlk Çalışan Sürüm

Bu sürüm mevcut Atlas Marine OS özelliklerini kaldırmadan aşağıdaki yetenekleri ekler:

- Resmî ve ücretsiz denizcilik yayınları için kaynak kataloğu
- Bölgeye göre kaynak sıralama ve açık kaynak künyeleri
- Mesafe, sürat, draft, tüketim ve yakıt payıyla passage-plan taslağı
- Appraisal, Planning, Execution ve Monitoring kontrol listeleri
- Her planda kaynak künyesi ve kaptan onayı zorunluluğu
- Eksik operasyonel veriyi tahmin etmek yerine `TBC` olarak gösterme

## Güvenlik sınırları

- Kodda Supabase gizli anahtarı veya OpenAI anahtarı bulunmaz.
- Telif durumu belirsiz yayınlar `metadata-only` olarak işaretlenir ve AI içeriğine alınmaz.
- Passage plan çıktısı bir taslaktır; güncel resmî harita, MSI/NAVTEX, Notices to Mariners, hava, liman ve pilot talimatlarıyla doğrulanmalıdır.
- Bu sürüm hiçbir dosyayı otomatik olarak buluta yüklemez ve web araması yapmaz.

## Yerel doğrulama

1. Captain Sinbad ekranını açın.
2. Passage Plan Studio bölümünü genişletin.
3. Kalkış, varış, mesafe, hız ve tekne bilgilerini girin.
4. `Create sourced draft` düğmesine basın.
5. Çıktıda `DRAFT — CAPTAIN APPROVAL REQUIRED`, kaynaklar ve güvenlik kapılarının bulunduğunu doğrulayın.
