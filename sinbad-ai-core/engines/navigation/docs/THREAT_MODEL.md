# Kısa tehdit modeli

| Tehdit / hata | Mevcut kontrol | Artık risk |
|---|---|---|
| Küre hesabının WGS84 sanılması | Açık `earthModel`, metadata, sessiz varsayılan yok | Eski API doğrudan çağrılabilir |
| Birim karışıklığı | `{ value, unit }` nicelik API’si | Eski API çıplak sayı kullanır |
| Eski/sahte canlı veri | Kaynak, zaman ve azami yaş kapısı | Kaynağın kriptografik kimliği doğrulanmaz |
| Tek sensör hatası | Farklı kaynak kimliği ve ayrışma kontrolü | Kaynakların fiziksel bağımsızlığı dışarıda doğrulanır |
| Rota üzerinde sessiz değişiklik | SHA-256 revizyon zinciri | Elektronik imza değildir |
| Yanlış hesaba insan onayı | Tam revizyon hash’ine bağlı onay | Kimlik doğrulama/PKI uygulama katmanına aittir |
| İç testin bağımsız doğrulama sanılması | Kanıt türü açık etiketlenir | Harici fixture kapsamı halen sınırlıdır |
| Eksik rota kanıtı | Her bacak için bağımsız `PASS` zorunlu | Kanıt üreticisinin güvenilirliği süreçle sağlanır |

Fail-safe ilke: belirsiz, eski, eksik veya tolerans dışı durumda sistem sonuç üretmeye zorlanmaz; `HOLD` döner ve insan incelemesi ister.
