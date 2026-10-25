# GeoInTime — التشغيل على Vercel

النسخة دي معمولة لـ Next.js/Vercel بدل Cloudflare Sites. كل تفاصيل الأسعار والبروبوزل زي ما هي، والبيانات بتتحفظ في Supabase مخصص، مش في ذاكرة Vercel المؤقتة.

1. افتح ريبو GitHub `mahmoud-ammar584/Geointime`، والأفضل تغيّر **Visibility** إلى Private قبل رفع الملفات لأن الكود فيه سياسات تسعير وتارجت.
2. ارفع **محتويات المجلد ده نفسه إلى جذر الريبو**، مش المجلد الخارجي ولا ملف ZIP كملف وحيد.
3. اعمل مشروع Supabase جديد مخصص للسيستم، ونفّذ ملف `supabase-schema.sql` في SQL Editor.
4. اربط GitHub repo على Vercel وحدد Next.js و `main` و Node.js 22.x، واترك Root Directory افتراضي.
5. ضيف الـ Environment Variables الموجودة في `.env.example` بعد تغيير القيم الوهمية لقيم حقيقية. لازم كلمتي المرور والمفتاح يفضلوا **Secrets** على Vercel فقط.
6. اعمل Deploy، وادخل على `/login` وبعدها جرّب حفظ كوتيشن وتنزيل PDF.

**ملحوظة:** بيانات الاستضافة القديمة لا تنتقل من ملفات الكود، لأن قاعدة البيانات الأصلية ليست ضمن ZIP.
**ملحوظة ثانية:** لو مفاتيح Supabase أو كلمة المرور مش متضافة، الموقع هيمنع الدخول أو يرفض الحفظ بدل ما يفتح بلا حماية.

لو حابب تدفع الملفات من الكمبيوتر بدل واجهة GitHub: فك ZIP، افتح Terminal داخل مجلد `GeoInTime-Commercial-Studio` وشغّل `bash scripts/push-to-github.sh` (Mac/Linux/Git Bash) أو `powershell -ExecutionPolicy Bypass -File scripts/push-to-github.ps1` (Windows PowerShell). لازم تكون عامل تسجيل دخول GitHub على Git Credential Manager.
