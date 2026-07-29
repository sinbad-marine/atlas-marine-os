# Supabase Reset Password e-posta şablonu

Atlas Marine OS v8.5, posta güvenlik tarayıcılarının tek kullanımlık bağlantıyı tüketmesini önlemek için 6 haneli OTP kodu kullanır.

Supabase Dashboard:

1. `Authentication → Email Templates`
2. `Reset password` şablonunu seçin.
3. Subject alanına şunu yazın:

`Atlas Marine OS şifre kurtarma kodu`

4. Message body alanındaki mevcut içeriği tamamen silip aşağıdakini yapıştırın:

```html
<h2>Atlas Marine OS Şifre Kurtarma</h2>
<p>Atlas Cloud hesabınız için şifre yenileme talebi aldık.</p>
<p>Doğrulama kodunuz:</p>
<h1 style="font-size:32px;letter-spacing:8px;">{{ .Token }}</h1>
<p>Bu 6 haneli kodu Atlas Marine OS içindeki şifre kurtarma penceresine yazın.</p>
<p>Bu talebi siz yapmadıysanız e-postayı görmezden gelebilirsiniz.</p>
```

5. `Save changes` düğmesine basın.

Şablona `{{ .ConfirmationURL }}` eklemeyin. Kullanıcı e-postadaki bağlantıya tıklamayacak; yalnızca `{{ .Token }}` ile üretilen kodu uygulamaya yazacaktır.
