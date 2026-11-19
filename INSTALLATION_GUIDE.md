# دليل التثبيت والتوزيع الاحترافي لويندوز - NG Financial System

يعمل **NG Financial System** محلياً دون اتصال باستخدام MariaDB 10.11.7 المرفقة، ويبدأ الخادم محلياً مع تشغيل التطبيق دون تسجيل خدمة Windows. عند التحديث من إصدار يستخدم SQLite، ينقل التطبيق السجلات إلى MariaDB تلقائياً عند أول تشغيل ويحافظ على ملف SQLite الأصلي.

---

## 1. حزم التثبيت المتاحة (Installer Packaging Options)

### الخيار 1: مثبت الإعداد القياسي (Inno Setup / NSIS Setup Wizard)
* **ملف البناء:** [`installer/Build-Installer.bat`](./installer/Build-Installer.bat)
* **ملف إعداد Inno Setup:** [`installer/NG-Financial-System.iss`](./installer/NG-Financial-System.iss)
* **الملف الناتج بعد التجميع:** `NG-Financial-System-Setup-1.0.22.exe`
* **المميزات الاحترافية:**
  - واجهة إعداد قياسية باللغتين العربية والإنجليزية.
  - إمكانية اختيار مسار التثبيت المخصص (الافتراضي: `C:\Program Files\NG Financial System`).
  - إنشاء اختصار رسمي على سطح المكتب (`Desktop Shortcut`) وقائمة ابدأ (`Start Menu`).
  - تضمين Node.js وملفات الخادم والواجهة وملفات MariaDB 10.11.7 وأدوات ترحيل SQLite.
  - منح مستخدم ويندوز صلاحية الكتابة إلى مجلد بيانات MariaDB وملف إعداد الاتصال.
  - إدراج معالج إلغاء التثبيت في لوحة تحكم ويندوز (`Control Panel -> Programs and Features`).

### الخيار 2: معالج التثبيت الفوري بنقرة واحدة (Native One-Click Wizard)
* **الملف المصدر:** [`installer/Install-NG-Financial-System.bat`](./installer/Install-NG-Financial-System.bat)
* **طريقة الاستخدام:** تشغيل الملف كمسؤول (`Run as Administrator`).
* **المهام التي يقوم بها تلقائياً:**
  1. طلب صلاحيات المسؤول UAC تلقائياً.
  2. نسخ وتهيئة ملفات النظام في المسار المعتمد.
  3. تهيئة MariaDB محلياً عند أول تشغيل ونقل بيانات SQLite الموجودة دون حذف الملف الأصلي.
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
2. **بناء الاعتمادات والواجهة:**
  - من جذر المشروع شغّل `npm install`، ثم من `client` شغّل `npm install` و`npm run build`.
3. **تجميع المثبت:**
  - شغّل `installer/Build-Installer.bat`.
  - يضمّن السكربت `node.exe` المطابق لنسخة Node المستخدمة لبناء الاعتمادات الأصلية.
   - سينتج المثبت في المجلد: `dist-installer/NG-Financial-System-Setup-1.0.22.exe`.

تُحفظ قاعدة MariaDB وبياناتها في مجلد `data` داخل مسار التثبيت، ويظل ملف SQLite القديم موجوداً بعد الترحيل كنسخة احتياطية. يتضمن الإصدار 1.0.22 حالات تأكيد وتجميد تسجيلات الطلاب، والمستحقات الشهرية للأفواج، وخادم MCP محلياً للاستعلام فقط. يتطلب بناء `Setup.exe` وجود Inno Setup 6؛ الناتج هو `dist-installer/NG-Financial-System-Setup-1.0.22.exe`.

## 3. ربط خادم MCP المحلي (للاستعلام فقط)

يتضمن المشروع خادم MCP محلياً يتيح لعميل MCP المدعوم الاستعلام عن ملخص الوضع المالي، والأفواج ومستحقاتها، والبحث عن تسجيلات الطلاب، وسجل دفعاتهم. لا يتيح أدوات لإضافة أو تعديل أو حذف أي بيانات، ولا يعرض أرقام الهواتف أو بيانات أولياء الأمور.

للتشغيل اليدوي من مجلد المشروع:

```powershell
npm run mcp:readonly
```

ولربطه بعميل سطح مكتب يدعم تشغيل خوادم MCP المحلية عبر `stdio`، أضف إعداداً مشابهاً إلى ملف إعداد العميل، مع استبدال مسار التثبيت بمسار جهازك:

```json
{
  "mcpServers": {
    "ng-financial-system": {
      "command": "C:\\Program Files\\NG Financial System\\runtime\\node.exe",
      "args": [
        "C:\\Program Files\\NG Financial System\\server\\mcp\\readOnlyServer.js"
      ],
      "cwd": "C:\\Program Files\\NG Financial System"
    }
  }
}
```

يجب أن يكون النظام قد أُعد واتصل بقاعدة البيانات مرة واحدة على الأقل، وأن يكون عميل MCP مغلقاً قبل تعديل إعداداته ثم إعادة تشغيله. عميل `stdio` محلي لا يتطلب فتح منفذ أو إنشاء نفق إنترنت. لا يعني ذلك أن ChatGPT على الويب يستطيع تشغيل الخادم المحلي مباشرة؛ يلزم أن يدعم تطبيق/حساب ChatGPT المستخدم خوادم MCP المحلية، وإلا فستحتاج إلى موصل بعيد آمن منفصل، وهو غير مضمن هنا. راجع الأدوات التي يطلب العميل تشغيلها ووافق عليها يدوياً.

اختبار خادم MCP:

```powershell
npm run test:mcp:readonly
```
