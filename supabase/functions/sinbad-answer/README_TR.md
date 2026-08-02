# Sinbad Answer Edge Function

Bu fonksiyon tarayıcıdaki kullanıcı oturumunu doğrular, kullanıcının seçilen workspace üyeliğini kontrol eder, yalnızca o workspace içindeki onaylı bilgi parçalarını toplar ve cevabı kaynak numaralarıyla üretir.

Gerekli sunucu sırları:

- `OPENAI_API_KEY`
- İsteğe bağlı `OPENAI_MODEL` (varsayılan: `gpt-5.6-terra`)

Supabase tarafından sağlanan `SUPABASE_URL` ve `SUPABASE_ANON_KEY` kullanılır. OpenAI anahtarı hiçbir zaman web uygulamasına veya GitHub deposuna yazılmamalıdır.

Fonksiyon dağıtılmadan önce:

1. GitHub deposunu private yapın veya hassas içeriği ayrı private depoya taşıyın.
2. `document_knowledge` ve `document_knowledge_chunks` RLS politikalarını doğrulayın.
3. Supabase secret olarak API anahtarını ekleyin.
4. Ödeme ve API harcama limiti için ürün sahibi onayı alın.
5. Fonksiyonu dağıtın ve yetkisiz workspace testi yapın.

Bu dosya yalnızca yerel hazırlıktır; fonksiyon otomatik olarak dağıtılmamıştır.
