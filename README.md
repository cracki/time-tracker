<p align="center">
  <img src="public/logo.png" width="120" alt="لوگوی زمان‌سنج" />
</p>

<h1 align="center">زمان‌سنج (Time Tracker)</h1>

<p align="center">
  وب‌اپلیکیشن سبک ثبت، بررسی و تأیید زمان کاری تیم — موبایل‌اول، فارسی و RTL، با پشتیبانی PWA.
</p>

---

## ✨ امکانات

- **ورود با OTP** — بدون رمز عبور؛ کد یک‌بارمصرف پیامکی (کاوه‌نگار) با محدودیت تلاش/انقضا. در حالت توسعه (بدون درایور SMS) کد در UI نمایش داده می‌شود.
- **ثبت سریع زمان** — فرمت ماسک‌دار `HH:MM` با کیبورد عددی، پیشنهادهای سریع، تشخیص «خارج از ساعت اداری / آخر هفته / تعطیل رسمی».
- **جریان تأیید مدیر** — تایید / اصلاح (با دکمه‌های ±۳۰ دقیقه) / رد با دلیل؛ ثبت نسخه‌ی اصلی و نسخه‌ی تأییدشده به‌صورت جداگانه.
- **داشبورد مدیر** — روند روزانه، ترکیب وضعیت‌ها، «بیشترین زمان افراد» (نمودار سازگار با RTL)، خارج از ساعت اداری، گزارش چاپی.
- **مدیریت کاربران** — ایجاد/ویرایش/غیرفعال‌سازی/حذف با محافظ‌های امنیتی (جلوگیری از حذف آخرین مدیر، قفل‌شدن خود مدیر و …).
- **آواتار** — هر کاربر می‌تواند آواتار آپلود کند (حداکثر ۵ مگابایت؛ سمت سرور کراپ مربعی، ریسایز ۲۵۶×۲۵۶ و بهینه‌سازی WebP).
- **آفلاین** — پیش‌نویس محلی هنگام قطع اینترنت و همگام‌سازی خودکار بعد از اتصال (+ شبیه‌ساز قطع اینترنت در حالت نمایشی).
- **PWA** — نصب روی گوشی، آفلاین‌شل، آیکون‌های کامل.
- **تقویم جلالی** — تاریخ‌ها، فیلترهای بازه‌ای و تعطیلات رسمی بر اساس تقویم شمسی.

## 🧰 پشته‌ی فناوری

| لایه | فناوری |
|---|---|
| فریم‌ورک | Next.js (App Router) + React + TypeScript |
| UI | Tailwind CSS v4 + shadcn/ui + Vazirmatn |
| داده | Prisma + SQLite |
| نمودار | Recharts (+ نمودارهای CSS خالص سازگار با RTL) |
| تصویر | sharp (بهینه‌سازی آواتار) |
| پیامک | کاوه‌نگار (Kavenegar) |
| تست | Vitest (unit + API) و Playwright (E2E) |

## 🚀 راه‌اندازی محلی (توسعه)

پیش‌نیاز: **Node.js 20+** (یا Bun)، مدیر بسته‌ی `npm` (یا `bun`).

```bash
git clone https://github.com/cracki/time-tracker.git
cd time-tracker
npm install            # یا: bun install

# متغیرهای محیطی
cp .env.example .env   # مقادیر را مطابق بخش «متغیرهای محیطی» تنظیم کنید

# دیتابیس (SQLite)
npx prisma db push
npx prisma generate
npm run db:seed        # داده‌ی نمونه (اختیاری)

npm run dev            # http://localhost:3000
```

> در حالت توسعه که `SMS_PROVIDER` خالی است، کد OTP داخل صفحه نمایش داده می‌شود (devCode) و می‌توانید بدون پنل پیامک وارد شوید. حساب‌های نمونه‌ی صفحه‌ی ورود با `NEXT_PUBLIC_DEMO_MODE=1` فعال می‌شوند.

### متغیرهای محیطی (`.env`)

| متغیر | توضیح |
|---|---|
| `DATABASE_URL` | مسیر فایل SQLite، مثل `file:../db/custom.db` |
| `SMS_PROVIDER` | خالی = حالت توسعه (نمایش کد در UI)؛ `kavenegar` = ارسال واقعی |
| `KAVENEGAR_API_KEY` | کلید API پنل کاوه‌نگار |
| `KAVENEGAR_OTP_TEMPLATE` | نام قالب ثبت‌شده با placeholder ‍`%token` |
| `KAVENEGAR_SENDER` | فقط برای ارسال مستقیم (سرویس Lookup نیازی به آن ندارد) |
| `NEXT_PUBLIC_DEMO_MODE` | `1` = نمایش حساب‌های نمونه و شبیه‌ساز قطع اینترنت. **برای production حذف/خالی کنید و حتماً rebuild بگیرید** (این متغیر هنگام build در کد تزریق می‌شود، نه هنگام اجرا) |

### تست‌ها

```bash
npm run test:unit   # تست‌های واحد
npm run test:api    # تست‌های API (سرور تست جدا با دیتابیس جدا)
npm run test:e2e    # Playwright
```

## 🖥 استقرار روی سرور Ubuntu

### ۱. پیش‌نیازهای سرور

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx
sudo npm i -g pm2

# فایروال
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### ۲. دریافت کد و build

```bash
sudo mkdir -p /var/www && cd /var/www
sudo git clone https://github.com/cracki/time-tracker.git
sudo chown -R $USER:$USER /var/www/time-tracker
cd time-tracker

cp .env.example .env
nano .env   # DATABASE_URL، SMS_PROVIDER=kavenegar و کلیدها؛ NEXT_PUBLIC_DEMO_MODE را حتماً حذف کنید

npm install
npx prisma db push        # ایجاد/به‌روزرسانی دیتابیس
npx prisma generate
npm run build             # خروجی standalone در .next/standalone
```

### ۳. همیشه روشن نگه‌داشتن بک‌اند (PM2)

```bash
pm2 start npm --name time-tracker -- start     # همان NODE_ENV=production + server.js استاندالون
pm2 save
pm2 startup systemd -u $USER --hp $HOME        # اجرای دستور چاپ‌شده را هم اجرا کنید
```

با این کار اپ با ریبوت سرور دوباره بالا می‌آید و در صورت کرش، PM2 آن را restart می‌کند.
بررسی: `pm2 status` / لاگ‌ها: `pm2 logs time-tracker`.

> ⚠️ **پوشه‌ی آپلودها بین دیپلوی‌ها حفظ شود:** آواتارها در `.next/standalone/public/uploads/avatars` نوشته می‌شوند. قبل از `npm run build` بعدی، این پوشه را کپی/بازگردانی کنید، مثلاً:
> ```bash
> cp -r .next/standalone/public/uploads /tmp/tt-uploads && npm run build && cp -r /tmp/tt-uploads .next/standalone/public/
> ```

### ۴. Nginx به‌عنوان وب‌سرور (دامنه + کش + پروکسی)

فایل کانفیگ را بسازید:

```bash
sudo nano /etc/nginx/sites-available/time-tracker
```

محتوای زیر را با **دامنه‌ی خودتان** جایگزین `time.example.com` کنید:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name time.example.com www.time.example.com;

    # آپلود آواتار تا ۵ مگابایت مجاز است؛ کمی بالاتر بگیرید
    client_max_body_size 10M;

    # ── کش: فایل‌های استاتیک Next.js (هش‌دار → کش دائمی) ──
    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_cache_valid 200 365d;
        expires 365d;
        add_header Cache-Control "public, immutable";
    }

    # ── کش: آیکون‌ها، لوگو و آواتارها ──
    location ~* ^/(icons|uploads)/.*\.(png|jpg|jpeg|webp|svg|ico)$ {
        proxy_pass http://127.0.0.1:3000;
        expires 30d;
        add_header Cache-Control "public";
    }

    # ── بقیه‌ی درخواست‌ها → Next.js ──
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # فشرده‌سازی (کاهش حجم پاسخ‌های JSON/HTML/SVG)
    gzip on;
    gzip_comp_level 5;
    gzip_min_length 256;
    gzip_proxied any;
    gzip_vary on;
    gzip_types
        text/plain text/css text/javascript
        application/javascript application/json
        application/xml image/svg+xml;
}
```

فعال‌سازی:

```bash
sudo ln -s /etc/nginx/sites-available/time-tracker /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### ۵. HTTPS رایگان با Certbot (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d time.example.com -d www.time.example.com
```

Certbot خودش redirect دائمی HTTP→HTTPS را به کانفیگ اضافه می‌کند و تمدید خودکار هم ثبت می‌شود:

```bash
sudo certbot renew --dry-run   # تست تمدید خودکار
```

### ۶. به‌روزرسانی (دیپلوی مجدد)

```bash
cd /var/www/time-tracker
git pull
npm install
cp -r .next/standalone/public/uploads /tmp/tt-uploads   # حفظ آواتارها
npx prisma db push
npm run build
cp -r /tmp/tt-uploads .next/standalone/public/
pm2 restart time-tracker
```

### ۷. پشتیبان‌گیری دیتابیس (SQLite)

```bash
# بکاپ امن (بدون خطر کپی حین نوشتن):
sqlite3 /var/www/time-tracker/db/custom.db ".backup '/var/backups/tt-$(date +%F).db'"
```

یک cron روزانه برای همین دستور توصیه می‌شود.

## 📁 ساختار پروژه (خلاصه)

```
src/
├── app/                # API routes (auth, admin, collab, settings, me/avatar)
├── components/         # UI مشترک (shadcn/ui + کامپوننت‌های اختصاصی)
├── features/           # صفحه‌ها بر اساس نقش (auth, collab, admin)
├── lib/                # سرویس API کلاینت، فرمت فارسی، جلالی، helpers سمت سرور
└── providers/          # Auth + React Query
prisma/schema.prisma    # مدل‌ها: User, TimeLog, Holiday, CalendarSettings, OtpSession, Session
tests/                  # unit + api + e2e
```

## 🔐 نکات امنیتی

- نشست‌ها با کوکی `httpOnly` و ذخیره‌ی **هش** توکن در دیتابیس.
- کد OTP هش‌شده ذخیره می‌شود با انقضا/محدودیت تلاش/فاصله‌ی ارسال مجدد.
- محافظ‌های نقش مدیر (آخرین مدیر قابل حذف/غیرفعال شدن نیست، مدیر نمی‌تواند خودش را قفل کند).
- `.env` هرگز در گیت نیست — کلیدهای کاوه‌نگار فقط روی سرور تنظیم می‌شوند.
