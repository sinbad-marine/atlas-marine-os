# Sinbad Answer Edge Function

Bu fonksiyon Sinbad'ın gerçek AI beynidir. Kullanıcı oturumunu ve workspace üyeliğini doğrular; özel kütüphaneden ilgili parçaları bulur, konuşma geçmişini kullanır ve kaynaklı cevap üretir. Kütüphanede eşleşme yoksa kararlı genel denizcilik bilgisiyle yardımcı olabilir. Güncel bilgi gerektiğinde kullanıcıdan web arama izni ister.

Gerekli sunucu sırları:

- `OPENAI_API_KEY`
- İsteğe bağlı `OPENAI_MODEL` (varsayılan: `gpt-5.6-terra`)

Supabase tarafından sağlanan `SUPABASE_URL` ve `SUPABASE_ANON_KEY` kullanılır. OpenAI anahtarı hiçbir zaman web uygulamasına veya GitHub deposuna yazılmamalıdır.

Canlıya alma sırası:

1. `OPENAI_API_KEY` değerini Supabase Edge Function secret olarak kaydedin.
2. `document_knowledge` ve `document_knowledge_chunks` RLS politikalarını doğrulayın.
3. `sinbad-answer` fonksiyonunu doğru Supabase projesine, statik web
   uygulamasından **önce** deploy edin.
4. `coreEnvelope` olmayan ve istemci kararıyla sunucu kararı uyuşmayan
   isteklerin `CORE_GATE_BLOCKED` ile, model çağrısından önce reddedildiğini
   doğrulayın.
5. Başarılı retrieval-only, private-RAG, general-AI ve web-assisted cevapların
   `permission: DECISION_SUPPORT_ONLY`, `executionPerformed: false` ve
   sunucunun yeniden hesapladığı `coreDecision` alanlarını taşıdığını doğrulayın.
6. Oturum açıkken genel sohbet, kütüphane sorusu ve açık izinli güncel web
   araması akışlarını ayrı ayrı test edin.
7. OpenAI kullanım bütçesi ve harcama alarmı belirleyin.

Bu klasördeki kodun GitHub Pages'e gönderilmesi Edge Function'ı otomatik deploy etmez; Supabase dağıtımı ayrıca yapılmalıdır.
Eski Edge Function ile yeni statik istemci birlikte kullanılırsa istemci cevabı
fail-closed reddeder; Core kapısı devre dışı bırakılmamalıdır.
