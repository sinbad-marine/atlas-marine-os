# Sinbad Marine v8.20.29

Sinbad Marine, çevrimdışı çalışabilen bir denizcilik karar destek ve özel çalışma alanı uygulamasıdır. Captain Sinbad; deterministik yerel denizcilik hesaplarını, isteğe bağlı ve yalnız sahibin cihazında çalışan Ollama/XTTS köprüsünü, onaylı özel Atlas Cloud bilgisini ve isteğe bağlı sunucu tarafı AI sağlayıcısını bir araya getirir.

## Doğrulanmış çalışma zamanı kabiliyetleri

- deterministik denizcilik niyeti, risk ve insan onayı sınıflandırması;
- sınırlı seyir hesapları ve taslak sefer planlama;
- kaynak gösteren yerel resmî eğitim içeriği erişimi;
- tarayıcı fallback'i bulunan yerel Ollama sohbeti ve sahibin cihazındaki XTTS sesi;
- kimlik doğrulamalı Supabase workspace, üye, belge ve özel medya akışları;
- özel belge metni çıkarma, indeksleme ve workspace kapsamlı erişim;
- `sinbad-answer` Edge Function üzerinden açık rızalı web destekli yanıtlar;
- GPX içe/dışa aktarma ve yerel OpenCPN rota alışverişi;
- izin tabanlı konum, kamera ve taslak jurnal kaydı.

## Core emniyet sınırı

Her yerel expert adaptörü `DECISION_SUPPORT_ONLY` düzeyindedir. Eski `execute` callback kayıtları artık sözleşme seviyesinde fail-closed reddedilir. Yetkilendirme, fiziksel kontrol yürütme veya aktüatör komutu iddia eden expert çıktısı engellenir.

Cloud ve açık rızalı web AI istekleri Core emniyet zarfı taşır. Edge Function, sağlayıcı çağrısından önce kararı bağımsız olarak yeniden hesaplar. Yetkili güvenlik sınırı bu sunucu tarafı yeniden hesaplamadır. Tarayıcı da eski deployment ve değiştirilmiş yanıt riskine karşı sonucu görüntülemeden önce doğrular; değiştirilmiş bir istemci güvenilir enforcement noktası değildir.

Sertleştirilmiş `sinbad-ai-core/` kanıt hattı `PLAN_ONLY` kalır. Expert çalıştırmadan veya seyir matematiğini aktive etmeden deterministik güvenilir kütüphane, provenance, doğrulama, citation, release ve tek kullanımlık teslim sözleşmeleri sağlar.

## Açık sınırlar

Sinbad Marine sertifikalı ECDIS/ECS, loading computer, klas/bayrak onay sistemi veya gemi kontrol/otonomi sistemi değildir. Aktüatörlere komut veremez, seferi onaylayamaz, güncel resmî harita ve yayınların yerine geçemez; kaptanı veya sorumlu insan operatörü geçersiz kılamaz.

Güncel meteoroloji, MSI, Notices to Mariners, trafik, liman durumu ve gemiye özgü gerçekler güncel yetkili kaynak ve bağımsız doğrulama gerektirir.

Canlı Sinbad karakteri çalışan katmanlı bir 2B rig ve sınırlı performans motorudur; henüz film kalitesinde tam 3B dijital insan değildir.

## Doğrulama

Depo kökünden tam Node regresyon paketini çalıştırın:

```powershell
npm test -- --test-reporter=dot
```

Navigation motorunun bağımsız release kapılarını çalıştırın:

```powershell
npm run verify --prefix sinbad-ai-core/engines/navigation
```

Masaüstü, mobil ve WCAG tarayıcı testlerini çalıştırın:

```powershell
npx playwright test tests/browser/release-quality.spec.js --reporter=line
```

Test sayısı yalnız çalıştırıldığı commit ve çalışma ağacı için kanıttır; gelecek revizyonlara ait kalıcı başarı iddiası değildir. Commit edilmemiş değişikliklerle alınan sonuç açıkça böyle etiketlenmelidir.

## Yayın sırası

Statik GitHub Pages paketi yayımlanmadan önce Supabase `sinbad-answer` Edge Function deploy edilmelidir. Ardından eksik veya değiştirilmiş Core zarfında `CORE_GATE_BLOCKED`, geçerli yanıtta ise `DECISION_SUPPORT_ONLY` doğrulanmalıdır. Ayrıntılar için `UPLOAD_ALL_FILES_TR.md`, `supabase/functions/sinbad-answer/README_TR.md` ve `LIVE_TEST_CHECKLIST_TR.md` belgelerine bakın.

Supabase service-role anahtarı, veritabanı parolası veya AI sağlayıcı anahtarı tarayıcı paketine ya da Git deposuna asla konulmamalıdır. Web uygulamasında yalnız Supabase publishable/anon anahtarı bulunabilir; workspace erişimi RLS ve sunucu tarafı üyelik denetimleriyle korunur.
