# دليل التثبيت والتوزيع الاحترافي لويندوز - NG Financial System

تم تصميم وتجهيز نظام **NG Financial System** كبرنامج مكتبي احترافي (Desktop Windows Application) يعمل محلياً بالكامل (Offline) مع قاعدة بيانات **MariaDB 10.11.7 Winx64**، ويشمل حزمة تثبيت متكاملة تحاكي معايير برامج الأعمال العالمية.

---

## 1. حزم التثبيت المتاحة (Installer Packaging Options)

### الخيار 1: مثبت الإعداد القياسي (Inno Setup / NSIS Setup Wizard)
* **الملف المصدر:** [`installer/NG-Financial-System.iss`](./installer/NG-Financial-System.iss)
* **الملف الناتج بعد التجميع:** `NG-Financial-System-Setup-1.0.0.exe`
* **المميزات الاحترافية:**
  - واجهة إعداد قياسية باللغتين العربية والإنجليزية.
  - أيقونة النظام الرسمية، والشعار، وبطاقة الترحيب بالأكاديمية.
  - إمكانية اختيار مسار التثبيت المخصص (الافتراضي: `C:\Program Files\NG Financial System`).
  - إنشاء اختصار رسمي على سطح المكتب (`Desktop Shortcut`) وقائمة ابدأ (`Start Menu`).
  - **التهيئة الآلية لـ MariaDB 10.11.7:** يقوم بتنفيذ أمر إنشاء قاعدة بيانات `ng_financial` واستيراد جداول `schema.sql` و`seed.sql` تلقائياً أثناء التثبيت.
  - إدراج معالج إلغاء التثبيت في لوحة تحكم ويندوز (`Control Panel -> Programs and Features`).

### الخيار 2: معالج التثبيت الفوري بنقرة واحدة (Native One-Click Wizard)
* **الملف المصدر:** [`installer/Install-NG-Financial-System.bat`](./installer/Install-NG-Financial-System.bat)
* **طريقة الاستخدام:** تشغيل الملف كمسؤول (`Run as Administrator`).
* **المهام التي يقوم بها تلقائياً:**
  1. طلب صلاحيات المسؤول UAC تلقائياً.
  2. نسخ وتهيئة ملفات النظام في المسار المعتمد.
  3. فحص خدمة MariaDB 10.11.7 على المنفذ `3306`، وإنشاء قاعدة البيانات والجداول فورياً.
  4. إنشاء اختصارات سطح المكتب وقائمة ابدأ عبر Windows Script Host (`VBScript`).
  5. إنشاء معالج إلغاء التثبيت النظيف `Uninstall.bat`.
  6. إطلاق النظام مباشرة في نافذة سطح المكتب.

### الخيار 3: النسخة المحمولة (Portable Edition)
* **الملف المصدر:** [`installer/Build-Portable.bat`](./installer/Build-Portable.bat)
* **المجلد الناتج:** `NG-Financial-System-Portable/`
* **المميزات:**
  - تعمل مباشرة من فلاش ديسك (USB) أو أي مجلد دون تثبيت في ملفات النظام.
  - مفيدة جداً للمعاينة السريعة والتنقل بين حواسيب إدارة الأكاديمية.
  - تشغيل فوري بنقرة واحدة على `تشغيل_النظام_المحمول.bat`.

---

## 2. كيفية بناء ملف `Setup.exe` المكتبي (Building the Installer)

1. **تثبيت أداة Inno Setup 6 على ويندوز:**
   - تنزيل مجاني من: [jrsoftware.org/isdl.php](https://jrsoftware.org/isdl.php)
2. **تجميع المثبت:**
   - فتح الملف `installer/NG-Financial-System.iss` داخل Inno Setup Compiler.
   - الضغط على `Compile` (أو `Ctrl + F9`).
   - سينتج المثبت في المجلد: `dist-installer/NG-Financial-System-Setup-1.0.0.exe`.
