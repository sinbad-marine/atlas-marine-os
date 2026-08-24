# SINBAD Yuvarlak Masa İncelemesi

Bu araç mevcut commit edilmemiş Git farkını üç bağımsız, salt-okunur incelemeye gönderir:

- Claude: güvenlik ve trust-boundary incelemesi
- Gemini: test, mimari ve geriye uyumluluk incelemesi
- Grok: mimari karşı-inceleme ve test açığı incelemesi

Modeller dosya değiştiremez, commit/push/deploy yapamaz. Yalnız kendilerine gönderilen diff'i görür ve `.roundtable/` altında rapor üretir.

## Güvenli anahtar kurulumu (Windows)

Anahtarları hiçbir dosyaya veya sohbete yapıştırmayın. Windows **Kullanıcı ortam değişkenleri** içine ekleyin:

- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`
- `GROK_API_KEY`

İsteğe bağlı model değişkenleri:

- `CLAUDE_REVIEW_MODEL` (varsayılan `claude-sonnet-5`)
- `GEMINI_REVIEW_MODEL` (varsayılan `gemini-3.5-flash-lite`)
- `GROK_REVIEW_MODEL` (varsayılan `grok-4.5`)

`ROUNDTABLE_REVIEWERS` değişkenini virgülle ayrılmış olarak açıkça ayarlayın. Örneğin yalnız Grok için `grok`, üçü için `claude,gemini,grok` kullanın. Değişken eksik veya boşsa ya da seçilen modellerden birinin API anahtarı yoksa araç hiçbir API isteği göndermeden hata verir.

Bu davranış önceki “anahtarı bulunan modeli otomatik çalıştır” düzeniyle geriye uyumlu değildir. Mevcut otomasyonlar geçiş sırasında `ROUNDTABLE_REVIEWERS` değerini açıkça tanımlamalıdır; güvenlik nedeniyle örtük eski moda dönüş yoktur.

## Yetenek izolasyonu

İnceleyiciler yerel ajan olarak çalışmaz; yalnız HTTPS üzerinden gönderilen Git farkını alıp metin döndüren uzak API'lerdir. Dosya sistemi, shell, Git, commit, push veya deploy araçlarına erişimleri yoktur. Yerel olarak yalnız bu Node.js aracı `.roundtable/` klasörüne rapor yazar.

Ortam değişkenleri eklendikten sonra Codex uygulamasını tamamen kapatıp yeniden açın.

## Çalıştırma

Codex'in paketlenmiş Node çalıştırıcısıyla:

```powershell
& 'C:\Users\ASUS\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tools\roundtable-review.js
```

Araç `git diff HEAD` ile birlikte yalnız açıkça izin verilen metin/kod uzantılarına sahip, 100 KB altındaki izlenmeyen dosyaları gönderir. `.env`, anahtar, token, credential ve sertifika adları reddedilir; dahil edilen izlenmeyen dosyalar terminalde listelenir. Gönderilecek farkı yine de önceden mutlaka inceleyin.

Gönderimden hemen önce eklenen diff satırları ayrıca bilinen sağlayıcı tokenları, özel anahtar başlıkları ve uzun credential atamaları için taranır. Eşleşme varsa hiçbir dış API çağrısı yapılmaz. Bu tarama savunma katmanıdır; tüm olası gizli veri biçimlerini garanti edemez.
