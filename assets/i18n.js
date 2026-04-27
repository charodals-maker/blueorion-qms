/**
 * BLUEORION QMS — Multilingual Support (English / Tagalog / Arabic)
 * Automatically injects a floating language switcher on every page.
 * Uses [data-i18n="key"] attributes for precise translation.
 * Also auto-translates common text strings via a phrase map.
 * Arabic enables RTL layout automatically.
 * v2.1 — language bar bottom-right, notifications bottom-left
 */
(function () {
  'use strict';

  // ─── TRANSLATION DICTIONARY ──────────────────────────────────────────────────
  const TRANSLATIONS = {
    en: {
      // Navigation
      home: 'Home',
      dashboard: 'Dashboard',
      login: 'Login',
      logout: 'Logout',
      register: 'Register',
      settings: 'Settings',
      profile: 'Profile',
      back: 'Back',
      menu: 'Menu',

      // Auth
      username: 'Username',
      password: 'Password',
      current_password: 'Current Password',
      new_password: 'New Password',
      confirm_password: 'Confirm Password',
      sign_in: 'Sign In',
      sign_out: 'Sign Out',
      welcome: 'Welcome',
      loading: 'Loading...',
      please_wait: 'Please wait...',

      // Common labels
      full_name: 'Full Name',
      first_name: 'First Name',
      last_name: 'Last Name',
      email: 'Email Address',
      phone: 'Phone Number',
      address: 'Address',
      nationality: 'Nationality',
      date_of_birth: 'Date of Birth',
      gender: 'Gender',
      position: 'Position',
      department: 'Department',
      country: 'Country',
      date: 'Date',
      status: 'Status',
      remarks: 'Remarks',
      description: 'Description',
      reference_no: 'Reference No.',
      amount: 'Amount',
      salary: 'Salary',
      daily_rate: 'Daily Rate',
      period: 'Period',

      // Buttons / Actions
      submit: 'Submit',
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      view: 'View',
      add: 'Add',
      add_new: 'Add New',
      search: 'Search',
      filter: 'Filter',
      export: 'Export',
      print: 'Print',
      close: 'Close',
      confirm: 'Confirm',
      update: 'Update',
      upload: 'Upload',
      download: 'Download',
      refresh: 'Refresh',
      approve: 'Approve',
      reject: 'Reject',
      open: 'Open',
      generate: 'Generate',
      reset: 'Reset',

      // Status values
      active: 'Active',
      inactive: 'Inactive',
      pending: 'Pending',
      completed: 'Completed',
      rejected: 'Rejected',
      approved: 'Approved',
      new: 'New',
      processing: 'Processing',
      deployed: 'Deployed',
      selected: 'Selected',
      cancelled: 'Cancelled',
      closed: 'Closed',
      open: 'Open',

      // Dashboard KPIs
      total_applicants: 'Total Applicants',
      selected_applicants: 'Selected',
      deployed_workers: 'Deployed',
      open_complaints: 'Open Complaints',
      qms_documents: 'QMS Documents',
      ofw_workers: 'OFW Workers',
      open_audit_items: 'Open Audit Items',
      compliance_rate: 'Compliance Rate',
      total_expenses: 'Total Expenses',
      hiring_pipeline: 'Hiring Pipeline',
      recent_activity: 'Recent Activity',
      system_status: 'System Status',
      quick_actions: 'Quick Actions',
      module_navigation: 'Module Navigation',

      // Modules
      module_sourcing: 'Sourcing & Selection',
      module_document: 'Document Control',
      module_welfare: 'Welfare Monitoring',
      module_audit: 'Audit & Improvement',
      module_fra: 'FRA System',
      module_deployment: 'Deployment Tracking',
      module_payroll: 'Payroll',
      module_attendance: 'Attendance / DTR',
      module_expenses: 'Expense Vouchers',
      module_reports: 'Reports',
      module_ofw: 'OFW Monitoring',
      module_complaints: 'Complaints & Grievance',

      // Forms
      passport_no: 'Passport No.',
      employer: 'Employer',
      contract_start: 'Contract Start',
      contract_end: 'Contract End',
      flight_date: 'Flight Date',
      oec_status: 'OEC Status',
      owwa_status: 'OWWA Status',
      insurance_status: 'Insurance Status',
      medical_status: 'Medical Status',
      tesda_status: 'TESDA Status',
      biometric_status: 'Biometric Status',

      // Payroll
      basic_pay: 'Basic Pay',
      overtime_pay: 'Overtime Pay',
      gross_pay: 'Gross Pay',
      net_pay: 'Net Pay',
      deductions: 'Deductions',
      sss: 'SSS',
      philhealth: 'PhilHealth',
      pagibig: 'Pag-IBIG',
      tax: 'Tax',
      loan: 'Loan',
      days_worked: 'Days Worked',
      overtime_hours: 'Overtime Hours',

      // Feedback / Notifications
      success: 'Success',
      error: 'Error',
      warning: 'Warning',
      info: 'Information',
      saved_successfully: 'Saved successfully',
      deleted_successfully: 'Deleted successfully',
      submitted_successfully: 'Submitted successfully',
      required_field: 'This field is required',
      invalid_email: 'Invalid email address',
      no_records: 'No records found',
      loading_data: 'Loading data...',
      confirm_delete: 'Are you sure you want to delete this record?',
      access_denied: 'Access Denied',
      not_authorized: 'You are not authorized to view this page.',

      // Workstation
      staff_workstation: 'Staff Workstation',
      attendance_dtr: 'Attendance / DTR',
      time_in: 'Time In',
      time_out: 'Time Out',
      hours_worked: 'Hours Worked',
      overtime: 'Overtime',
      present: 'Present',
      absent: 'Absent',
      late: 'Late',
      on_leave: 'On Leave',

      // Apply page
      apply_now: 'Apply Now',
      job_application: 'Job Application',
      upload_resume: 'Upload Resume',
      upload_photo: 'Upload Photo',
      cover_letter: 'Cover Letter',
      work_experience: 'Work Experience',
      education: 'Education',
      skills: 'Skills',

      // Misc
      blueorion_qms: 'BLUEORION QMS',
      quality_management: 'Quality Management System',
      iso_compliant: 'ISO 9001:2015 Compliant',
      copyright: '© 2026 Blueorion Manpower Agency',
      language: 'Language',
      select_language: 'Select Language',
    },

    tl: {
      // Navigation
      home: 'Tahanan',
      dashboard: 'Dashboard',
      login: 'Mag-login',
      logout: 'Mag-logout',
      register: 'Mag-rehistro',
      settings: 'Mga Setting',
      profile: 'Profile',
      back: 'Bumalik',
      menu: 'Menu',

      // Auth
      username: 'Username',
      password: 'Password',
      current_password: 'Kasalukuyang Password',
      new_password: 'Bagong Password',
      confirm_password: 'Kumpirmahin ang Password',
      sign_in: 'Mag-sign In',
      sign_out: 'Mag-sign Out',
      welcome: 'Maligayang pagdating',
      loading: 'Naglo-load...',
      please_wait: 'Mangyaring maghintay...',

      // Common labels
      full_name: 'Buong Pangalan',
      first_name: 'Unang Pangalan',
      last_name: 'Apelyido',
      email: 'Email Address',
      phone: 'Numero ng Telepono',
      address: 'Tirahan',
      nationality: 'Nasyonalidad',
      date_of_birth: 'Petsa ng Kapanganakan',
      gender: 'Kasarian',
      position: 'Posisyon',
      department: 'Departamento',
      country: 'Bansa',
      date: 'Petsa',
      status: 'Katayuan',
      remarks: 'Mga Tala',
      description: 'Paglalarawan',
      reference_no: 'Ref. No.',
      amount: 'Halaga',
      salary: 'Sahod',
      daily_rate: 'Araw-araw na Rate',
      period: 'Panahon',

      // Buttons / Actions
      submit: 'Isumite',
      save: 'I-save',
      cancel: 'Kanselahin',
      delete: 'Burahin',
      edit: 'I-edit',
      view: 'Tingnan',
      add: 'Magdagdag',
      add_new: 'Magdagdag ng Bago',
      search: 'Maghanap',
      filter: 'I-filter',
      export: 'I-export',
      print: 'I-print',
      close: 'Isara',
      confirm: 'Kumpirmahin',
      update: 'I-update',
      upload: 'Mag-upload',
      download: 'I-download',
      refresh: 'I-refresh',
      approve: 'Aprubahan',
      reject: 'Tanggihan',
      open: 'Buksan',
      generate: 'Gumawa',
      reset: 'I-reset',

      // Status values
      active: 'Aktibo',
      inactive: 'Hindi Aktibo',
      pending: 'Nakabinbin',
      completed: 'Natapos',
      rejected: 'Tinanggihan',
      approved: 'Naaprubahan',
      new: 'Bago',
      processing: 'Pinoproseso',
      deployed: 'Na-deploy',
      selected: 'Napili',
      cancelled: 'Nakansela',
      closed: 'Sarado',
      open: 'Bukas',

      // Dashboard KPIs
      total_applicants: 'Kabuuang Aplikante',
      selected_applicants: 'Napili',
      deployed_workers: 'Na-deploy',
      open_complaints: 'Bukas na Reklamo',
      qms_documents: 'Mga Dokumento ng QMS',
      ofw_workers: 'Mga OFW',
      open_audit_items: 'Bukas na Audit',
      compliance_rate: 'Rate ng Pagsunod',
      total_expenses: 'Kabuuang Gastos',
      hiring_pipeline: 'Proseso ng Pagkuha',
      recent_activity: 'Kamakailang Aktibidad',
      system_status: 'Status ng Sistema',
      quick_actions: 'Mabilis na Aksyon',
      module_navigation: 'Mga Module',

      // Modules
      module_sourcing: 'Paghahanap at Pagpili',
      module_document: 'Kontrol ng Dokumento',
      module_welfare: 'Pangasiwa ng Kapakanan',
      module_audit: 'Audit at Pagpapabuti',
      module_fra: 'Sistema ng FRA',
      module_deployment: 'Pagsubaybay ng Deployment',
      module_payroll: 'Payroll',
      module_attendance: 'Attendance / DTR',
      module_expenses: 'Voucher ng Gastos',
      module_reports: 'Mga Ulat',
      module_ofw: 'Monitoring ng OFW',
      module_complaints: 'Reklamo at Pagrereklamo',

      // Forms
      passport_no: 'Blg. ng Pasaporte',
      employer: 'Employer',
      contract_start: 'Simula ng Kontrata',
      contract_end: 'Katapusan ng Kontrata',
      flight_date: 'Petsa ng Lipad',
      oec_status: 'Status ng OEC',
      owwa_status: 'Status ng OWWA',
      insurance_status: 'Status ng Insurance',
      medical_status: 'Status ng Medical',
      tesda_status: 'Status ng TESDA',
      biometric_status: 'Status ng Biometric',

      // Payroll
      basic_pay: 'Pangunahing Sahod',
      overtime_pay: 'Sahod sa Overtime',
      gross_pay: 'Gross na Sahod',
      net_pay: 'Net na Sahod',
      deductions: 'Mga Bawas',
      sss: 'SSS',
      philhealth: 'PhilHealth',
      pagibig: 'Pag-IBIG',
      tax: 'Buwis',
      loan: 'Utang',
      days_worked: 'Araw na Nagtrabaho',
      overtime_hours: 'Oras ng Overtime',

      // Feedback / Notifications
      success: 'Matagumpay',
      error: 'Error',
      warning: 'Babala',
      info: 'Impormasyon',
      saved_successfully: 'Matagumpay na na-save',
      deleted_successfully: 'Matagumpay na nabura',
      submitted_successfully: 'Matagumpay na naisumite',
      required_field: 'Kinakailangan ang field na ito',
      invalid_email: 'Hindi wastong email address',
      no_records: 'Walang nahanap na rekord',
      loading_data: 'Naglo-load ng data...',
      confirm_delete: 'Sigurado ka bang gusto mong burahin ang rekord na ito?',
      access_denied: 'Hindi Pinahintulutan',
      not_authorized: 'Wala kang pahintulot na tingnan ang pahinang ito.',

      // Workstation
      staff_workstation: 'Workstation ng Staff',
      attendance_dtr: 'Attendance / DTR',
      time_in: 'Oras ng Pagpasok',
      time_out: 'Oras ng Paglabas',
      hours_worked: 'Oras na Nagtrabaho',
      overtime: 'Overtime',
      present: 'Naroroon',
      absent: 'Wala',
      late: 'Huli',
      on_leave: 'Nasa Bakasyon',

      // Apply page
      apply_now: 'Mag-apply Ngayon',
      job_application: 'Aplikasyon sa Trabaho',
      upload_resume: 'Mag-upload ng Resume',
      upload_photo: 'Mag-upload ng Larawan',
      cover_letter: 'Cover Letter',
      work_experience: 'Karanasan sa Trabaho',
      education: 'Edukasyon',
      skills: 'Mga Kasanayan',

      // Misc
      blueorion_qms: 'BLUEORION QMS',
      quality_management: 'Sistema ng Kalidad ng Pamamahala',
      iso_compliant: 'ISO 9001:2015 na Sumusunod',
      copyright: '© 2026 Blueorion Manpower Agency',
      language: 'Wika',
      select_language: 'Pumili ng Wika',
    },

    ar: {
      // Navigation
      home: 'الرئيسية',
      dashboard: 'لوحة التحكم',
      login: 'تسجيل الدخول',
      logout: 'تسجيل الخروج',
      register: 'إنشاء حساب',
      settings: 'الإعدادات',
      profile: 'الملف الشخصي',
      back: 'رجوع',
      menu: 'القائمة',

      // Auth
      username: 'اسم المستخدم',
      password: 'كلمة المرور',
      current_password: 'كلمة المرور الحالية',
      new_password: 'كلمة المرور الجديدة',
      confirm_password: 'تأكيد كلمة المرور',
      sign_in: 'تسجيل الدخول',
      sign_out: 'تسجيل الخروج',
      welcome: 'أهلاً وسهلاً',
      loading: 'جارٍ التحميل...',
      please_wait: 'يرجى الانتظار...',

      // Common labels
      full_name: 'الاسم الكامل',
      first_name: 'الاسم الأول',
      last_name: 'اسم العائلة',
      email: 'البريد الإلكتروني',
      phone: 'رقم الهاتف',
      address: 'العنوان',
      nationality: 'الجنسية',
      date_of_birth: 'تاريخ الميلاد',
      gender: 'الجنس',
      position: 'المسمى الوظيفي',
      department: 'القسم',
      country: 'البلد',
      date: 'التاريخ',
      status: 'الحالة',
      remarks: 'ملاحظات',
      description: 'الوصف',
      reference_no: 'رقم المرجع',
      amount: 'المبلغ',
      salary: 'الراتب',
      daily_rate: 'المعدل اليومي',
      period: 'الفترة',

      // Buttons / Actions
      submit: 'إرسال',
      save: 'حفظ',
      cancel: 'إلغاء',
      delete: 'حذف',
      edit: 'تعديل',
      view: 'عرض',
      add: 'إضافة',
      add_new: 'إضافة جديد',
      search: 'بحث',
      filter: 'تصفية',
      export: 'تصدير',
      print: 'طباعة',
      close: 'إغلاق',
      confirm: 'تأكيد',
      update: 'تحديث',
      upload: 'رفع',
      download: 'تنزيل',
      refresh: 'تحديث الصفحة',
      approve: 'موافقة',
      reject: 'رفض',
      open: 'فتح',
      generate: 'إنشاء',
      reset: 'إعادة تعيين',

      // Status values
      active: 'نشط',
      inactive: 'غير نشط',
      pending: 'في الانتظار',
      completed: 'مكتمل',
      rejected: 'مرفوض',
      approved: 'موافق عليه',
      new: 'جديد',
      processing: 'قيد المعالجة',
      deployed: 'تم النشر',
      selected: 'تم الاختيار',
      cancelled: 'ملغى',
      closed: 'مغلق',
      open: 'مفتوح',

      // Dashboard KPIs
      total_applicants: 'إجمالي المتقدمين',
      selected_applicants: 'المختارون',
      deployed_workers: 'العمال المُرسَلون',
      open_complaints: 'الشكاوى المفتوحة',
      qms_documents: 'وثائق الجودة',
      ofw_workers: 'العمال الفلبينيون في الخارج',
      open_audit_items: 'بنود التدقيق المفتوحة',
      compliance_rate: 'معدل الامتثال',
      total_expenses: 'إجمالي المصروفات',
      hiring_pipeline: 'مسار التوظيف',
      recent_activity: 'النشاط الأخير',
      system_status: 'حالة النظام',
      quick_actions: 'إجراءات سريعة',
      module_navigation: 'الوحدات',

      // Modules
      module_sourcing: 'التوريد والاختيار',
      module_document: 'التحكم في الوثائق',
      module_welfare: 'مراقبة الرفاهية',
      module_audit: 'التدقيق والتحسين',
      module_fra: 'نظام FRA',
      module_deployment: 'تتبع النشر',
      module_payroll: 'الرواتب',
      module_attendance: 'الحضور / سجل الدوام',
      module_expenses: 'قسائم المصروفات',
      module_reports: 'التقارير',
      module_ofw: 'مراقبة العمال في الخارج',
      module_complaints: 'الشكاوى والتظلمات',

      // Forms
      passport_no: 'رقم جواز السفر',
      employer: 'صاحب العمل',
      contract_start: 'بداية العقد',
      contract_end: 'نهاية العقد',
      flight_date: 'تاريخ السفر',
      oec_status: 'حالة OEC',
      owwa_status: 'حالة OWWA',
      insurance_status: 'حالة التأمين',
      medical_status: 'الحالة الطبية',
      tesda_status: 'حالة TESDA',
      biometric_status: 'حالة البصمة',

      // Payroll
      basic_pay: 'الراتب الأساسي',
      overtime_pay: 'بدل الساعات الإضافية',
      gross_pay: 'الراتب الإجمالي',
      net_pay: 'صافي الراتب',
      deductions: 'الاستقطاعات',
      sss: 'SSS',
      philhealth: 'PhilHealth',
      pagibig: 'Pag-IBIG',
      tax: 'الضريبة',
      loan: 'القرض',
      days_worked: 'أيام العمل',
      overtime_hours: 'ساعات إضافية',

      // Feedback / Notifications
      success: 'نجاح',
      error: 'خطأ',
      warning: 'تحذير',
      info: 'معلومة',
      saved_successfully: 'تم الحفظ بنجاح',
      deleted_successfully: 'تم الحذف بنجاح',
      submitted_successfully: 'تم الإرسال بنجاح',
      required_field: 'هذا الحقل مطلوب',
      invalid_email: 'بريد إلكتروني غير صالح',
      no_records: 'لا توجد سجلات',
      loading_data: 'جارٍ تحميل البيانات...',
      confirm_delete: 'هل أنت متأكد أنك تريد حذف هذا السجل؟',
      access_denied: 'الوصول مرفوض',
      not_authorized: 'غير مصرح لك بعرض هذه الصفحة.',

      // Workstation
      staff_workstation: 'محطة عمل الموظف',
      attendance_dtr: 'الحضور / سجل الدوام',
      time_in: 'وقت الحضور',
      time_out: 'وقت الانصراف',
      hours_worked: 'ساعات العمل',
      overtime: 'ساعات إضافية',
      present: 'حاضر',
      absent: 'غائب',
      late: 'متأخر',
      on_leave: 'في إجازة',

      // Apply page
      apply_now: 'تقدم الآن',
      job_application: 'طلب توظيف',
      upload_resume: 'رفع السيرة الذاتية',
      upload_photo: 'رفع الصورة',
      cover_letter: 'خطاب التقديم',
      work_experience: 'الخبرة العملية',
      education: 'التعليم',
      skills: 'المهارات',

      // Misc
      blueorion_qms: 'BLUEORION QMS',
      quality_management: 'نظام إدارة الجودة',
      iso_compliant: 'متوافق مع ISO 9001:2015',
      copyright: '© 2026 وكالة Blueorion للقوى العاملة',
      language: 'اللغة',
      select_language: 'اختر اللغة',
    }
  };

  // ─── LANGUAGE METADATA ────────────────────────────────────────────────────────
  const LANGS = {
    en: { label: 'EN', full: 'English',  dir: 'ltr', flag: '🇺🇸' },
    tl: { label: 'TL', full: 'Tagalog',  dir: 'ltr', flag: '🇵🇭' },
    ar: { label: 'AR', full: 'العربية', dir: 'rtl', flag: '🇸🇦' }
  };

  const STORAGE_KEY = 'blueorion_lang';
  let currentLang = localStorage.getItem(STORAGE_KEY) || 'en';

  // ─── TRANSLATION FUNCTION ─────────────────────────────────────────────────────
  function t(key) {
    return (TRANSLATIONS[currentLang] && TRANSLATIONS[currentLang][key])
      || (TRANSLATIONS.en[key])
      || key;
  }

  // ─── APPLY TRANSLATIONS TO DOM ────────────────────────────────────────────────
  function applyTranslations() {
    const lang = LANGS[currentLang];

    // Set html attributes
    document.documentElement.lang = currentLang;
    document.documentElement.dir  = lang.dir;

    // RTL body style adjustments
    if (lang.dir === 'rtl') {
      document.body.style.fontFamily = "'Segoe UI', 'Arial', 'Tahoma', sans-serif";
      if (!document.getElementById('blueorion-rtl-style')) {
        const rtlStyle = document.createElement('style');
        rtlStyle.id = 'blueorion-rtl-style';
        rtlStyle.textContent = `
          body[dir="rtl"] * { text-align: right !important; }
          body[dir="rtl"] .topbar-left, body[dir="rtl"] .topbar-right { flex-direction: row-reverse; }
          body[dir="rtl"] input, body[dir="rtl"] textarea, body[dir="rtl"] select { text-align: right; direction: rtl; }
          body[dir="rtl"] .input-group label { text-align: right; }
          body[dir="rtl"] table th, body[dir="rtl"] table td { text-align: right; }
        `;
        document.head.appendChild(rtlStyle);
      }
      document.body.setAttribute('dir', 'rtl');
    } else {
      document.body.removeAttribute('dir');
      const rtlStyle = document.getElementById('blueorion-rtl-style');
      if (rtlStyle) rtlStyle.remove();
    }

    // Translate all [data-i18n] elements
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const translation = t(key);
      if (el.tagName === 'INPUT' && (el.type === 'text' || el.type === 'search')) {
        el.placeholder = translation;
      } else if (el.tagName === 'INPUT' && el.type === 'submit') {
        el.value = translation;
      } else {
        el.textContent = translation;
      }
    });

    // Translate [data-i18n-placeholder] elements
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
    });

    // Translate [data-i18n-title] elements (tooltips)
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      el.title = t(el.getAttribute('data-i18n-title'));
    });

    // Update language switcher pill active states
    const switcher = document.getElementById('bo-lang-switcher');
    if (switcher) {
      switcher.querySelectorAll('.bo-pill').forEach(btn => {
        btn.classList.toggle('bo-active', btn.dataset.lang === currentLang);
      });
    }
  }

  // ─── INJECT LANGUAGE SWITCHER UI ─────────────────────────────────────────────
  function injectSwitcher() {
    if (document.getElementById('bo-lang-switcher')) return;

    const style = document.createElement('style');
    style.id = 'bo-lang-style';
    style.textContent = `
      #bo-lang-switcher {
        position: fixed !important;
        bottom: 90px !important;
        right: 18px !important;
        left: auto !important;
        z-index: 2147483647 !important;
        display: flex !important;
        flex-direction: row !important;
        align-items: center !important;
        gap: 0 !important;
        font-family: 'Segoe UI', Arial, Tahoma, sans-serif !important;
        background: #003366 !important;
        border-radius: 30px !important;
        padding: 4px 6px !important;
        box-shadow: 0 4px 18px rgba(0,51,102,0.55) !important;
        user-select: none !important;
      }
      html[dir="rtl"] #bo-lang-switcher {
        right: auto !important;
        left: 18px !important;
      }
      #bo-lang-switcher .bo-globe-icon {
        color: rgba(255,255,255,0.7) !important;
        font-size: 15px !important;
        padding: 0 6px 0 4px !important;
        display: inline-block !important;
      }
      #bo-lang-switcher .bo-pill {
        background: transparent !important;
        color: rgba(255,255,255,0.75) !important;
        border: none !important;
        outline: none !important;
        border-radius: 22px !important;
        padding: 6px 11px !important;
        font-size: 12px !important;
        font-weight: 700 !important;
        cursor: pointer !important;
        letter-spacing: 0.5px !important;
        transition: background 0.18s, color 0.18s !important;
        white-space: nowrap !important;
        line-height: 1 !important;
        display: inline-flex !important;
        align-items: center !important;
        gap: 5px !important;
        font-family: 'Segoe UI', Arial, Tahoma, sans-serif !important;
        text-decoration: none !important;
      }
      #bo-lang-switcher .bo-pill:hover {
        background: rgba(255,255,255,0.18) !important;
        color: #ffffff !important;
      }
      #bo-lang-switcher .bo-pill.bo-active {
        background: #ffffff !important;
        color: #003366 !important;
        box-shadow: 0 1px 6px rgba(0,0,0,0.18) !important;
      }
      #bo-lang-switcher .bo-pill .bo-flag {
        font-size: 14px !important;
        line-height: 1 !important;
      }
      @media (max-width: 480px) {
        #bo-lang-switcher {
          bottom: 86px !important;
          right: 10px !important;
          left: auto !important;
        }
        html[dir="rtl"] #bo-lang-switcher {
          right: auto !important;
          left: 10px !important;
        }
        #bo-lang-switcher .bo-pill {
          padding: 5px 9px !important;
          font-size: 11px !important;
        }
      }
    `;
    document.head.appendChild(style);

    const wrapper = document.createElement('div');
    wrapper.id = 'bo-lang-switcher';
    wrapper.setAttribute('role', 'toolbar');
    wrapper.setAttribute('aria-label', 'Language selector');

    // Globe icon
    const globe = document.createElement('span');
    globe.className = 'bo-globe-icon';
    globe.textContent = '\uD83C\uDF10'; // 🌐
    wrapper.appendChild(globe);

    // One pill per language — always visible
    Object.entries(LANGS).forEach(([code, meta]) => {
      const btn = document.createElement('button');
      btn.className = 'bo-pill' + (code === currentLang ? ' bo-active' : '');
      btn.dataset.lang = code;
      btn.setAttribute('type', 'button');
      btn.setAttribute('aria-pressed', code === currentLang ? 'true' : 'false');
      btn.setAttribute('title', meta.full + ' (' + code.toUpperCase() + ')');
      btn.innerHTML = '<span class="bo-flag">' + meta.flag + '</span> ' + meta.label;
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        setLanguage(code);
      });
      wrapper.appendChild(btn);
    });

    document.body.appendChild(wrapper);
  }

  // ─── SET LANGUAGE ─────────────────────────────────────────────────────────────
  function setLanguage(lang) {
    if (!LANGS[lang]) return;
    currentLang = lang;
    localStorage.setItem(STORAGE_KEY, lang);

    // Update pill button active states
    const switcher = document.getElementById('bo-lang-switcher');
    if (switcher) {
      switcher.querySelectorAll('.bo-pill').forEach(function(btn) {
        const isActive = btn.dataset.lang === lang;
        btn.classList.toggle('bo-active', isActive);
        btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
    }

    applyTranslations();

    // Dispatch event for any page-specific listeners
    document.dispatchEvent(new CustomEvent('blueorion:langchange', { detail: { lang: lang, dir: LANGS[lang].dir, t: t } }));
  }

  // ─── PUBLIC API ───────────────────────────────────────────────────────────────
  window.BlueorionI18n = {
    t,
    setLanguage,
    getCurrentLang: () => currentLang,
    getLangs: () => LANGS,
    TRANSLATIONS
  };

  // ─── INIT ─────────────────────────────────────────────────────────────────────
  function init() {
    injectSwitcher();
    applyTranslations();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
