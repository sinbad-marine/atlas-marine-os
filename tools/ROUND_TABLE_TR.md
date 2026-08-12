# SINBAD Yuvarlak Masa İncelemesi

Bu araç mevcut commit edilmemiş Git farkını iki bağımsız, salt-okunur incelemeye gönderir:

- Claude: güvenlik ve trust-boundary incelemesi
- Gemini: test, mimari ve geriye uyumluluk incelemesi

Modeller dosya değiştiremez, commit/push/deploy yapamaz. Yalnız kendilerine gönderilen diff'i görür ve `.roundtable/` altında rapor üretir.

## Güvenli anahtar kurulumu (Windows)

Anahtarları hiçbir dosyaya veya sohbete yapıştırmayın. Windows **Kullanıcı ortam değişkenleri** içine ekleyin:

- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`

İsteğe bağlı model değişkenleri:

- `CLAUDE_REVIEW_MODEL` (varsayılan `claude-sonnet-5`)
- `GEMINI_REVIEW_MODEL` (varsayılan `gemini-3.6-flash`)

Ortam değişkenleri eklendikten sonra Codex uygulamasını tamamen kapatıp yeniden açın.

## Çalıştırma

Codex'in paketlenmiş Node çalıştırıcısıyla:

```powershell
& 'C:\Users\ASUS\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tools\roundtable-review.js
```

Araç `git diff HEAD` ile birlikte yalnız açıkça izin verilen metin/kod uzantılarına sahip, 100 KB altındaki izlenmeyen dosyaları gönderir. `.env`, anahtar, token, credential ve sertifika adları reddedilir; dahil edilen izlenmeyen dosyalar terminalde listelenir. Gönderilecek farkı yine de önceden mutlaka inceleyin.
