# SINBAD Yuvarlak Masa İncelemesi

Bu araç açıkça seçilen Git farkını bağımsız, salt-okunur incelemelere gönderir:

- Claude: güvenlik ve trust-boundary incelemesi
- Grok: saldırgan emniyet ve sınır incelemesi
- Gemini: isteğe bağlı test, mimari ve geriye uyumluluk incelemesi

Modeller dosya değiştiremez, commit/push/deploy yapamaz. Yalnız kendilerine gönderilen diff'i görür ve `.roundtable/` altında rapor üretir.

## Güvenli anahtar kurulumu (Windows)

Anahtarları hiçbir dosyaya veya sohbete yapıştırmayın. Windows **Kullanıcı ortam değişkenleri** içine ekleyin:

- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`
- `GROK_API_KEY`

İsteğe bağlı model değişkenleri:

- `CLAUDE_REVIEW_MODEL` (varsayılan `claude-sonnet-5`)
- `GEMINI_REVIEW_MODEL` (varsayılan `gemini-3.6-flash`)
- `GROK_REVIEW_MODEL` (varsayılan `grok-4.5`)

Ortam değişkenleri eklendikten sonra Codex uygulamasını tamamen kapatıp yeniden açın.

## Çalıştırma

Codex'in paketlenmiş Node çalıştırıcısıyla:

```powershell
$env:ROUNDTABLE_REVIEWERS='claude,grok'
$env:ROUNDTABLE_BASE_REF='origin/main'
& 'C:\Users\ASUS\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' tools\roundtable-review.js
```

`ROUNDTABLE_REVIEWERS` zorunludur; boş bırakılırsa hiçbir model çağrılmaz.
`ROUNDTABLE_BASE_REF` verilirse araç `base...HEAD`, verilmezse `HEAD` ile
commit edilmemiş farkı inceler. Diff limit aşımında kırpılmak yerine fail-closed
durur. Yalnız izin verilen metin/kod uzantılı, 100 KB altındaki izlenmeyen
dosyalar eklenir. `.env`, anahtar, token, credential ve sertifika adları
reddedilir; gönderilecek farkı önceden mutlaka inceleyin.
