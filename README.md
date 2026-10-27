# EBYÜ İdeal Hukuk Kulübü — GitHub Pages Anket Platformu

Bu paket, gönderdiğiniz orijinal HTML anket tasarımını ve parçacık animasyonlarını temel alan GitHub Pages sürümüdür. Yeni **GÖNDERİLİYOR** sahnesinde harfler 3B olarak yaklaşır, kamera harf aralarından geçer, onaylanan gönderimden sonra parçacık patlamasıyla **Anket Gönderildi** ekranına dönüşür. Kulüp logosu sağ üst köşededir.

## Önemli teknik gerçekler

**GitHub Pages PHP, Python, Node.js sunucu kodlarını çalıştırmaz.** Yalnızca Pages ile merkezi yanıt kaydetme ve güvenli yönetici oturumu oluşturulamaz. Bu proje iki mod sunar:

1. **Pages tek başına / demo modu:** Yönetici ekranında 21 soru türü, zorunlu sorular, sürükleme yerine yukarı/aşağı sıralama, önizleme, grafikler, CSV, yedek, en fazla 10 aktif anket ve arşiv vardır. Anket tanımları yönetici cihazının localStorage alanında tutulur. `surveys-data.js` GitHub'a yüklenince anket linkleri herkes için çalışır. Ancak katılımcı cevapları yalnızca katılımcının kendi tarayıcısına kaydedilir; **yönetici bunları otomatik göremez**. JSON dosyasıyla manuel dışa/içe aktarım yapılabilir.
2. **İsteğe bağlı Google Doküman köprüsü:** GitHub Pages aynı kalır. Google Apps Script, sahip olduğunuz Google Dokümanı'na **yalnızca şifreli içerik** ekleyen isteğe bağlı ek işlem katmanıdır. Yönetici paneli özel anahtar ve READ_KEY ile şifreli kayıtları anket ID'sine göre içe aktarır. Bu seçenek ek bir Google hizmetine ihtiyaç duyduğu için 'tamamen yalnızca GitHub Pages' değildir. Google Apps Script ücretsiz kotalar içerir; sonsuz/garantili ücretsiz kullanım sözü verilemez.

## 1. GitHub Pages kurulumu

1. `index.html`, `app.js`, `admin.css`, `surveys-data.js`, `bridge-config.js`, `bridge-client.js`, `logo.png`, `.nojekyll` dosyalarını **aynı dizine** yükleyin.
2. GitHub > Repository > Settings > Pages > Deploy from branch > `main` / root seçin.
3. Örnek site: `https://KULLANICI.github.io/DEPO/`.
4. Ana sayfa giriş ekranıdır. İstenen kullanıcı adı/şifreyle giriş yapın. **Bu demo kilidi gerçek güvenlik sağlamaz**; bütün statik dosyalar herkese açıktır. Şifreyi herkese açık repoda korumak mümkün değildir. Bu şifre sohbet içinde paylaşıldığı için gerçek sistemlerde yeniden kullanılmamalıdır.
5. `Yeni Anket` ile form oluşturun, seçenekleri/zorunluluğu düzenleyin, önizleyin, yayınlayın.
6. `Anketlerim > GitHub yayın dosyasını indir` ile yeni `surveys-data.js` alın. Bu dosyayı depodaki aynı dosyanın **üzerine yükleyin**. Böylece yeni yayın bağlantısı herkes için açılır.
7. `surveys-data.js` dosyasını her aktif anket güncellemesi/durdurma/yeniden yayınlama işleminden sonra tekrar yükleyin. GitHub Pages otomatik olarak depoya dosya yazamaz. 11. aktif anket, en eski aktif olanı arşivler. Arşivdekiler 10'lu sayfalarda kalır; eski anket yeniden yayınlanabilir. Önceki yanıtların arşivde saklanması **localStorage veya şifreli Doküman kaydının varlığına** bağlıdır; yayın dosyasını küçük tutmak yanıt verisi boyutunu sıfırlamaz.
8. Ankete tıklayan herkes URL'deki `?s=ANKET_ID` üzerinden aynı tasarımı görür. Paylaşılmayan diğer anketler arayüz üzerinden listelenmez ama **yayındaki anket tanımları** herkese açık `surveys-data.js` dosyasında okunabilir; bu gerçek erişim kontrolü değildir.

> Orijinal sayfanız GSAP, Three.js, Tailwind CDN ve Google Fonts'a bağlıdır. Görselliği bozmamak amacıyla bu CDN bağlantıları korundu; dolayısıyla animasyon kütüphaneleri için tam çevrimdışı/bağımsız bir dağıtım **değildir**. Node.js kurulumuna ihtiyaç duyulmaz.

## 2. Google Doküman'a şifreli gerçek yanıt toplama (isteğe bağlı)

Bu seçenek **Google Dokümanı'na doğrudan anonim yazma** değildir. İnternete açık Apps Script `doPost` çağrısı şifreli JSON paketi doğrular; Doküman'a Script hesabı aracılığıyla ekler. Sonrasında admin, imzalı sorguyla şifreli paketleri okur ve özel anahtarıyla çözer.

1. Kullanmak istediğiniz Google Dokümanı'nın düzenleme erişiminin **herkese açık olmadığından** emin olun. Verdiğiniz Doküman bağlantısının ID kısmı: `1uLR6ajjMaVUKbP1ObXa8uzt8QS2OqMc1twUoP8jO5Vo` — Apps Script hesabınızın bu belgeye yazma hakkı olmalı. İsterseniz yeni ve kısıtlı erişimli bir doküman oluşturun.
2. `https://script.google.com/` üzerinden yeni proje oluşturun. Paketteki `google-apps-script/Code.gs` dosyasının içeriğini proje koduna yapıştırın.
3. `Project Settings > Script Properties` bölümüne şu iki gizli ayarı ekleyin:

   - `DOC_ID` = kullandığınız Google Dokümanı'nın ID'si
   - `READ_KEY` = güçlü, uzun, rastgele bir sır (tercihen 32+ karakter; yalnızca sizin tarafınızda saklayın; **GitHub'a koymayın**).

4. `Deploy > New deployment > Web app`: **Execute as: Me**, **Who has access: Anyone** seçin. Google'ın izin ekranı üzerinden Docs erişimine yalnızca Script sahibi yetki verir. Bu `/exec` adresini kopyalayın.
5. GitHub'daki **`bridge-config.js`** içindeki boş `endpoint` alanına bu URL'yi girin ve yükleyin. Bu adres gizli anahtar değildir; yayınlanabilir. `/exec` ile bitmeli.
6. Yönetici panelinde **Drive senkronizasyonu** sekmesinden `Anahtar üret` seçeneğini **yalnızca bir kez** çalıştırın. İnen `OZEL-ANAHTAR-GITHUBA-YUKLEME.json` dosyasını güvenli yerde, tercihen şifreli kişisel depoda saklayın. **Asla GitHub'a veya herkese açık Drive'a koymayın.** Kayıp anahtar kurtarılamaz; kayıtları çözemezsiniz.
7. Tekrar `Anketlerim > GitHub yayın dosyasını indir` ile **açık anahtar da içeren** `surveys-data.js` dosyasını yeniden yayımlayın.
8. Katılımcılar bu aşamadan sonra anket yanıtı gönderdiğinde HTTPS tarayıcı WebCrypto kullanarak `RSA-OAEP + AES-GCM` ile veriyi şifreleyip Apps Script'e gönderir. İstek başarılı olmadan başarı ekranı gösterilmez. (Ağ zaman aşımı varsa ilk göndermenin ulaşıp ulaşmadığı kesin doğrulanamayabilir; tekrarlar yanıt ID'siyle içe aktarımda tekilleştirilir.)
9. Yönetici **Drive senkronizasyonu** sekmesinde özel anahtar JSON dosyasını seçer, READ_KEY girer, anketi seçer ve `Drive'dan çek` der. Veriler anket ID'sine göre çözülerek bu cihazın tarayıcı veritabanına kaydedilir. **Özel anahtar ve READ_KEY** otomatik olarak GitHub'a veya Drive'a gönderilmez. `READ_KEY` sadece yerel olarak imzalama için kullanılır.
10. **ÖNEMLİ:** Google Dokümanı otomatik temizlenmez. Tarayıcıdaki localStorage kalıcı güvenilir sunucu veritabanı değildir. İlk iş olarak `Özel yedek indir`, CSV al; bunları şifreli sakla. Dokümanı hemen silmek veri kaybına yol açar. Google Dokümanı'ndan silme gerekiyorsa, önce yedekleri birden fazla yerde doğrulayın ve manuel bakım yapın.

### Güvenlik / sınırlar

- Demo paneline verilen kullanıcı adı/şifre **sunucu doğrulaması değildir**. Ön yüzdeki JavaScript ve hash okunabilir. Şifreli yanıtların gizliliği ayrı tuttuğunuz özel anahtara dayanır; güvenli admin kimlik doğrulaması için gerçek bir backend gereklidir.
- Açık yazma uç noktası kötüye kullanım/spam / veri şişirmeye karşı tam dayanıklı değildir. Herkese açık linkler, kişiyi tanımlamaz. Yanıtlayanların gerçek kimliklerini, IP adresini veya kimin hangi sayfayı ziyaret ettiğini bu uygulama doğrulayamaz.
- Yanıt metinleri, anket ID'si, zaman damgası, kullanıcı aracısından türetilen yaklaşık cihaz/tarayıcı kategorileri şifrelenir. Özel bir kimlik sorusu oluşturmadıkça gerçek isim bilinmez. Kişisel veriler için uygun aydınlatma/onay süreçleri gerekir.
- Google Dokümanı'nın düzenleme hakkını **herkese açık** tutarsanız başkaları verileri silebilir/değiştirebilir. Şifreleme bunu önlemez. Anket cevabı veren kişilerin Doküman düzenleme yetkisine ihtiyacı **yoktur**; yazmayı Apps Script yapar.
- `READ_KEY` imzalı sorgularda imzalama için kullanılır; sunucunun Script Properties ayarında saklanır. İmza istek süresi ve nonce ile sınırlıdır. Özel RSA anahtarı yalnızca yöneticide kalır.
- Yeni anahtar üretmek eski yanıtları eski anahtar olmadan okunamaz hâle getirir. Anahtarları mutlaka yedekleyin.
- Apps Script servis tarafı **canlı Google hesabında test edilmedi**. Yerel Chromium testlerinde yönetim/anket döngüsü, Node WebCrypto testinde şifreleme/çözme doğrulandı. Gerçek web app deployment, Drive kota/izin/CSP ve 3D tarayıcı davranışı canlı yayında ayrıca kontrol edilmeli.
- `file` soru türü yalnızca **dosya adı** sorar, gerçek dosya yüklemez. Gerçek medya yükleme ayrı sunucu/depolama altyapısı gerektirir.
- Yayında olmayan anket linkleri yeni `surveys-data.js` GitHub'da güncellendikten sonra kapanır. GitHub Pages/CDN önbelleği nedeniyle eski yayın birkaç dakika daha görülebilir; anında yetki iptali garantisi yoktur.

## Teknik dosya haritası

- `index.html`: Orijinal 3D görünüm, soru geçişleri, yeni harf tüneli.
- `admin.css`: Mobil uyumlu yönetici/istatistik arayüzü.
- `app.js`: 21 soru türü, yerel yönetim, 10 aktif anket, arşiv, yanıt istatistikleri, Drive eşitleme.
- `logo.png`: Gönderdiğiniz İdeal Hukuk Kulübü logosu.
- `surveys-data.js`: GitHub'a elle güncellenen halka açık aktif anket tanımları.
- `bridge-config.js`: Opsiyonel Google Apps Script URL ayarı.
- `bridge-client.js`: Tarayıcıda şifreleme/çözme + köprü istemcisi.
- `google-apps-script/Code.gs`: Google Dokümanı'na şifreli kayıt ekleyen ve yöneticiye imzalı sorgu ile kayıtları dönen isteğe bağlı sunucu kodu.

## Kontrol listesi

- [ ] Web sayfası ve logo açıldı
- [ ] Yönetici girişi demo uyarısıyla çalıştı
- [ ] Bir anket oluşturup `surveys-data.js` GitHub'a güncellendi
- [ ] Katılımcı sayfasında 3D animasyonlar çalıştı
- [ ] 11. anket 1. anketi arşivledi
- [ ] Drive kullanılıyorsa özel anahtar güvenle yedeklendi
- [ ] Drive kullanılıyorsa önce test anketinden şifreli kayıt ve geri çekme doğrulandı
- [ ] GitHub deposunda hiçbir özel anahtar/READ_KEY bulunmuyor
- [ ] Doküman paylaşımı `Kısıtlı` olarak ayarlandı
