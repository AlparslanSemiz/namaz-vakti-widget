// ============================================================
//  NAMAZ VAKTİ (ScriptWidget)
//  Konum   : ScriptWidget native $location (CoreLocation)
//            Alınamazsa IP üzerinden yaklaşık konum
//  Vakitler: Aladhan API (method=13, Diyanet)
//  Şehir   : BigDataCloud reverse-geocode (koordinattan şehir adı)
//  Önbellek: $storage -> aynı gün ve aynı konumda ağ isteği yok
//  Renkler : Her zeminde okunan sabit renkler (vurgular mavi)
// ============================================================

// --- Ayarlar ---
const METHOD = 13; // Diyanet İşleri Başkanlığı
// Hiçbir konum kaynağı çalışmazsa kullanılacak son çare konum:
const FALLBACK = { lat: 49.0069, lon: 8.4037, city: "Karlsruhe" };
// Konumu elle sabitlemek istersen (izin gerektirmez) alttaki satırı doldur,
// ör: const SABIT_KONUM = { lat: 41.0082, lon: 28.9784, city: "İstanbul" };
const SABIT_KONUM = null;

// --- Bugünün tarihi (Aladhan formatı: DD-MM-YYYY) ---
const today = new Date();
const dd = today.getDate().toString().padStart(2, '0');
const mm = (today.getMonth() + 1).toString().padStart(2, '0');
const yyyy = today.getFullYear();
const dateStr = `${dd}-${mm}-${yyyy}`;

// --- Önbellek ---
let cache = null;
try { cache = $storage.getJSON("namaz_cache"); } catch (e) {}
const cacheBugune = !!(cache && cache.date === dateStr && cache.timings);

let timings = null;
let city = "";
let lat = null, lon = null;
let ipCity = "";
let src = ""; // kullanılan konum kaynağı: sabit / gps / ip / cache / fallback

// --- 0) Elle sabitlenmiş konum varsa doğrudan onu kullan ---
if (SABIT_KONUM && SABIT_KONUM.lat != null) {
  lat = SABIT_KONUM.lat; lon = SABIT_KONUM.lon; city = SABIT_KONUM.city || ""; src = "sabit";
}

// --- 1) Cihaz konumunu oku (native CoreLocation) ---
// Konum her yenilemede denenir, böylece şehir değişince vakitler de değişir.
// Not: Widget kendi başına izin penceresi açamaz. iOS'ta script'i bir kez
// ScriptWidget uygulamasının içinde çalıştırıp çıkan konum iznini onaylamak
// gerekir. macOS sürümü konum desteklemiyor, orada SABIT_KONUM ya da IP kullanılır.
if (lat == null) {
  try {
    if (typeof $location !== "undefined" && $location.isAvailable()) {
      let st = null;
      try { st = $location.authorizationStatus(); } catch (e) {}
      // İzin yalnızca durum açıkça "authorized" derse istenmez. Durum
      // okunamazsa da istek denenir ki uygulama içinde izin penceresi çıksın.
      const izinli = (typeof st === "string") && st.toLowerCase().indexOf("authorized") >= 0;
      if (!izinli) {
        try { await $location.requestAuthorization({ timeout: 5 }); } catch (e) {}
      }
      const loc = await $location.current({
        timeout: 10,
        maxAge: 1800,          // 30 dakikaya kadar önbellekli konumu kabul et (hızlı ve pil dostu)
        accuracy: "reduced",   // şehir seviyesi yeterli
        purposeKey: "NamazVakti"
      });
      if (loc && loc.latitude != null) { lat = loc.latitude; lon = loc.longitude; src = "gps"; }
    }
  } catch (e) {}
}

// --- 2) Cihaz konumu alınamadıysa yedekler ---
// Bugünün verisi zaten cihaz ya da IP konumuyla alındıysa ona güvenilir.
// Aksi halde IP üzerinden yaklaşık konum denenir, böylece eski ya da
// yanlış bir kayıt önbellekte diye gün boyu yanlış şehir gösterilmez.
const cacheKonumGuvenilir = cacheBugune && cache.lat != null && (cache.src === "gps" || cache.src === "ip");
if (lat == null && cacheKonumGuvenilir) {
  lat = cache.lat; lon = cache.lon; src = cache.src;
}
if (lat == null) {
  try {
    const ipRaw = await fetch("https://ipwho.is/");
    const ip = JSON.parse(ipRaw);
    const ipLat = parseFloat(ip.latitude), ipLon = parseFloat(ip.longitude);
    if (!isNaN(ipLat) && !isNaN(ipLon)) { lat = ipLat; lon = ipLon; ipCity = ip.city || ""; src = "ip"; }
  } catch (e) {}
}
if (lat == null) {
  if (cache && cache.lat != null) { lat = cache.lat; lon = cache.lon; city = cache.city || ""; src = cache.src || "fallback"; }
  else { lat = FALLBACK.lat; lon = FALLBACK.lon; city = FALLBACK.city; src = "fallback"; }
}

// --- 3) Aynı gün ve aşağı yukarı aynı yerdeysek ağa çıkma ---
// Konum yaklaşık 20 km'den fazla değiştiyse vakitler yeniden çekilir
function ayniYer(a, b, c, d) {
  return Math.abs(a - c) <= 0.2 && Math.abs(b - d) <= 0.2;
}

if (cacheBugune && cache.lat != null && ayniYer(lat, lon, cache.lat, cache.lon)) {
  timings = cache.timings;
  city = cache.city || city;
  // Eski sürümden kalan kayıtta konum kaynağı yoksa kayıt bir kez güncellenir,
  // böylece gün boyu gereksiz IP sorgusu yapılmaz
  if (!cache.src && src) {
    try { $storage.setJSON("namaz_cache", { date: cache.date, timings, city, lat: cache.lat, lon: cache.lon, src }); } catch (e) {}
  }
} else {
  // --- Şehir adını çöz (koordinattan, reverse geocode) ---
  // Şehir adı zaten belliyse (sabit konum, yedek vb.) tekrar sorulmaz
  if (!city) {
    try {
      const gRaw = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=tr`);
      const g = JSON.parse(gRaw);
      city = g.city || g.locality || g.principalSubdivision || ipCity;
    } catch (e) { city = ipCity; }
  }

  // --- Vakitleri çek (Aladhan, Diyanet) ---
  try {
    const url = `https://api.aladhan.com/v1/timings/${dateStr}?latitude=${lat}&longitude=${lon}&method=${METHOD}`;
    const rawResponse = await fetch(url);
    const json = JSON.parse(rawResponse);
    timings = json.data.timings;

    // --- Önbelleğe yaz (gün ve konum değişene kadar tekrar ağa çıkılmaz) ---
    try {
      $storage.setJSON("namaz_cache", { date: dateStr, timings, city, lat, lon, src });
    } catch (e) {}
  } catch (e) {
    // Ağ hatasında eski önbellek varsa onu göster (vakitler bir iki dakika sapabilir)
    if (cache && cache.timings) { timings = cache.timings; city = cache.city || city; }
  }
}

// Saatleri dakikaya çevirme
function getMins(timeStr) {
  const parts = timeStr.split(':');
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

const p = [
  { name: "İmsak", time: timings.Fajr, mins: getMins(timings.Fajr) },
  { name: "Güneş", time: timings.Sunrise, mins: getMins(timings.Sunrise) },
  { name: "Öğle", time: timings.Dhuhr, mins: getMins(timings.Dhuhr) },
  { name: "İkindi", time: timings.Asr, mins: getMins(timings.Asr) },
  { name: "Akşam", time: timings.Maghrib, mins: getMins(timings.Maghrib) },
  { name: "Yatsı", time: timings.Isha, mins: getMins(timings.Isha) }
];

// Şu anki vakit, kalan süre
const now = new Date();
const currentMins = now.getHours() * 60 + now.getMinutes();
const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

let activeIdx = 5;
for (let i = 0; i < 5; i++) {
  if (currentMins >= p[i].mins && currentMins < p[i+1].mins) { activeIdx = i; break; }
}
if (currentMins >= p[5].mins || currentMins < p[0].mins) { activeIdx = 5; }

const nextIdx = (activeIdx + 1) % 6;
let diff = p[nextIdx].mins - currentMins;
if (diff < 0) diff += 24 * 60;

const hLeft = Math.floor(diff / 60);
const mLeft = diff % 60;
const timeLeftStr = hLeft > 0 ? `${hLeft}sa ${mLeft}dk` : `${mLeft}dk`;

const activeName = p[activeIdx].name;
const nextName = p[nextIdx].name;

// Kerahat vakti (sembolik uyarı)
let isKerahat = false;
if (currentMins >= p[1].mins && currentMins <= p[1].mins + 45) isKerahat = true;
if (currentMins >= p[2].mins - 45 && currentMins < p[2].mins) isKerahat = true;
if (currentMins >= p[4].mins - 45 && currentMins < p[4].mins) isKerahat = true;
const kerahatSembolu = isKerahat ? " ⚠️" : "";

// Şehir adını kısalt (saat de sığsın diye) ve şehir + saat olarak birleştir
let cityShort = city || "";
if (cityShort.length > 5) cityShort = cityShort.substring(0, 3) + ".";
const headerRight = cityShort ? `${cityShort} ${currentTimeStr}` : currentTimeStr;

// Vurgu sistemi: widget zemini platforma, moda ve duvar kağıdına göre açık ya
// da koyu olabildiği için zeminden bağımsız, her yerde okunan renkler kullanılır
const activeColor = "#007aff"; // vurgular: başlık, sıradaki vakit, geri sayım
const dimTitle = "#8e8e93";    // sönük vakit adları
const dimTime = "#8e8e93";     // sönük saatler ve üst bilgi

const fTitleImsak = nextIdx === 0 ? "subheadline" : "caption2";
const cTitleImsak = nextIdx === 0 ? activeColor : dimTitle;
const fTimeImsak = nextIdx === 0 ? "headline" : "footnote";
const cTimeImsak = nextIdx === 0 ? activeColor : dimTime;
const sImsak = nextIdx === 0 ? "» İmsak" : "İmsak";

const fTitleGunes = nextIdx === 1 ? "subheadline" : "caption2";
const cTitleGunes = nextIdx === 1 ? activeColor : dimTitle;
const fTimeGunes = nextIdx === 1 ? "headline" : "footnote";
const cTimeGunes = nextIdx === 1 ? activeColor : dimTime;
const sGunes = nextIdx === 1 ? "» Güneş" : "Güneş";

const fTitleOgle = nextIdx === 2 ? "subheadline" : "caption2";
const cTitleOgle = nextIdx === 2 ? activeColor : dimTitle;
const fTimeOgle = nextIdx === 2 ? "headline" : "footnote";
const cTimeOgle = nextIdx === 2 ? activeColor : dimTime;
const sOgle = nextIdx === 2 ? "» Öğle" : "Öğle";

const fTitleIkindi = nextIdx === 3 ? "subheadline" : "caption2";
const cTitleIkindi = nextIdx === 3 ? activeColor : dimTitle;
const fTimeIkindi = nextIdx === 3 ? "headline" : "footnote";
const cTimeIkindi = nextIdx === 3 ? activeColor : dimTime;
const sIkindi = nextIdx === 3 ? "» İkindi" : "İkindi";

const fTitleAksam = nextIdx === 4 ? "subheadline" : "caption2";
const cTitleAksam = nextIdx === 4 ? activeColor : dimTitle;
const fTimeAksam = nextIdx === 4 ? "headline" : "footnote";
const cTimeAksam = nextIdx === 4 ? activeColor : dimTime;
const sAksam = nextIdx === 4 ? "» Akşam" : "Akşam";

const fTitleYatsi = nextIdx === 5 ? "subheadline" : "caption2";
const cTitleYatsi = nextIdx === 5 ? activeColor : dimTitle;
const fTimeYatsi = nextIdx === 5 ? "headline" : "footnote";
const cTimeYatsi = nextIdx === 5 ? activeColor : dimTime;
const sYatsi = nextIdx === 5 ? "» Yatsı" : "Yatsı";

// Arayüz
$render(
  <vstack background="clear" padding={12} spacing={5}>

    {/* Üst bilgi: Ay ikonu (SF Symbol) + başlık + şehir & saat */}
    <hstack alignment="center" spacing={5}>
      <icon systemName="moon.fill" size="14" color={activeColor} />
      <text font="subheadline" color={activeColor}>Namaz</text>
      <spacer />
      <text font="caption2" color={dimTime}>{headerRight}</text>
    </hstack>

    {/* Şu anki vakit ve kalan süre (bold; kalan süre özellikle vurgulu) */}
    <hstack alignment="center" spacing={4} padding={2}>
      <spacer />
      <text font="footnote" color={activeColor} bold="true">{activeName} ·</text>
      <text font="subheadline" color={activeColor} bold="true">{timeLeftStr}{kerahatSembolu}</text>
      <spacer />
    </hstack>

    <spacer length={2} />

    {/* Vakitler */}
    <hstack>
      <text font={fTitleImsak} color={cTitleImsak}>{sImsak}</text>
      <spacer />
      <text font={fTimeImsak} color={cTimeImsak}>{timings.Fajr}</text>
    </hstack>

    <hstack>
      <text font={fTitleGunes} color={cTitleGunes}>{sGunes}</text>
      <spacer />
      <text font={fTimeGunes} color={cTimeGunes}>{timings.Sunrise}</text>
    </hstack>

    <hstack>
      <text font={fTitleOgle} color={cTitleOgle}>{sOgle}</text>
      <spacer />
      <text font={fTimeOgle} color={cTimeOgle}>{timings.Dhuhr}</text>
    </hstack>

    <hstack>
      <text font={fTitleIkindi} color={cTitleIkindi}>{sIkindi}</text>
      <spacer />
      <text font={fTimeIkindi} color={cTimeIkindi}>{timings.Asr}</text>
    </hstack>

    <hstack>
      <text font={fTitleAksam} color={cTitleAksam}>{sAksam}</text>
      <spacer />
      <text font={fTimeAksam} color={cTimeAksam}>{timings.Maghrib}</text>
    </hstack>

    <hstack>
      <text font={fTitleYatsi} color={cTitleYatsi}>{sYatsi}</text>
      <spacer />
      <text font={fTimeYatsi} color={cTimeYatsi}>{timings.Isha}</text>
    </hstack>

  </vstack>
);
