/**
 * Arabic is the default — the club's staff work in it, and the old portal
 * shipped ar-first.
 *
 * Register follows the Flutter app (fairly standard MSA) rather than the old
 * web portal's Egyptian colloquial, since staff see both and the app is the
 * one they use daily.
 *
 * Adding a key to `en` and forgetting it in `ar` is a build error — see the
 * exhaustiveness assertion below.
 */

export const locales = ['ar', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'ar';

export const dictionaries = {
  ar: {
    appName: 'أو هاوس',
    appSubtitle: 'لوحة الإدارة',

    // auth
    signIn: 'تسجيل الدخول',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    signInButton: 'تسجيل الدخول',
    signOut: 'تسجيل الخروج',
    signInError: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
    signInMissingFields: 'أدخل البريد الإلكتروني وكلمة المرور.',
    notAuthorized: 'هذا الحساب لا يملك صلاحية الدخول إلى لوحة الإدارة.',

    // nav
    navAssignments: 'المهام',
    navPlaces: 'الأماكن',
    navUsers: 'المستخدمون',
    navDepartments: 'الأقسام',
    collapseSidebar: 'طي القائمة',
    expandSidebar: 'توسيع القائمة',

    // statuses (assignments_v.effective_status)
    statusPending: 'قيد الانتظار',
    statusInProgress: 'قيد التنفيذ',
    statusSubmitted: 'تم الإرسال',
    statusApproved: 'معتمدة',
    statusRejected: 'مرفوضة',
    statusExpired: 'منتهية',

    itemPending: 'لم تُنفَّذ',
    itemDone: 'تم',
    itemRejected: 'مرفوضة',

    roleAdmin: 'مدير',
    roleManager: 'مشرف',
    roleInspector: 'مفتش',
    roleCleaner: 'عامل نظافة',

    // common
    loading: 'جارٍ التحميل…',
    noData: 'لا توجد بيانات',
    status: 'الحالة',
    subtasks: 'المهام الفرعية',
    back: 'رجوع',
    place: 'المكان',
    assignee: 'المسؤول',
    date: 'التاريخ',
    window: 'الفترة',
    deadline: 'الموعد النهائي',
    progress: 'التقدم',
    signature: 'التوقيع',
    photo: 'صورة',
    note: 'ملاحظة',
    rejectReason: 'سبب الرفض',
    requiresPhoto: 'صورة مطلوبة',
    extended: 'تم التمديد',
    language: 'English',
    save: 'حفظ',
    cancel: 'إلغاء',
    create: 'إنشاء',
    edit: 'تعديل',
    remove: 'حذف',
    confirmDelete: 'هل أنت متأكد من الحذف؟',
    saved: 'تم الحفظ',
    errorGeneric: 'حدث خطأ. حاول مرة أخرى.',
    optional: 'اختياري',
    none: '—',
    actions: 'إجراءات',

    // assignment creation + review
    newAssignment: 'مهمة جديدة',
    assignmentTitleAr: 'عنوان المهمة (عربي)',
    assignmentTitleEn: 'عنوان المهمة (إنجليزي)',
    scheduledDate: 'تاريخ التنفيذ',
    windowStart: 'من',
    windowEnd: 'إلى',
    selectPlace: 'اختر المكان',
    selectAssignee: 'اختر المسؤول',
    subtasksFromPlace: 'المهام الفرعية مأخوذة من المكان — عدّلها كما تريد.',
    addSubtask: 'إضافة مهمة فرعية',
    subtaskAr: 'النص (عربي)',
    subtaskEn: 'النص (إنجليزي)',
    critical: 'حرجة',
    assignmentCreated: 'تم إنشاء المهمة',
    fieldsRequired: 'أكمل الحقول المطلوبة.',
    missingFields: 'حقول ناقصة:',
    required: 'مطلوب',
    placeHasNoSite: 'هذا المكان غير مرتبط بموقع، ولا يمكن إسناد مهمة له. عدّله وأعد حفظه.',
    needAtLeastOneSubtask: 'أضف مهمة فرعية واحدة على الأقل.',
    subtaskNeedsText: 'كل مهمة فرعية تحتاج نصاً بالعربية أو الإنجليزية.',

    approve: 'اعتماد',
    reject: 'رفض مهام',
    extend: 'تمديد',
    newDeadline: 'الموعد النهائي الجديد',
    extensionNote: 'سبب التمديد',
    selectItemsToReject: 'اختر المهام المرفوضة',
    reasonRequired: 'اكتب سبب الرفض.',
    noItemsSelected: 'لم تختر أي مهمة.',
    notInSubmittedState: 'المهمة ليست في حالة "تم الإرسال".',
    alreadyClosed: 'المهمة مغلقة ولا يمكن تمديدها.',
    deadlineMustBeFuture: 'الموعد النهائي يجب أن يكون في المستقبل.',
    reviewNote: 'ملاحظة المراجعة',

    // places (templates)
    newPlace: 'مكان جديد',
    placeNameAr: 'الاسم (عربي)',
    placeNameEn: 'الاسم (إنجليزي)',
    defaultSubtasks: 'المهام الفرعية الافتراضية',
    itemsCount: 'عدد المهام',
    department: 'القسم',
    allDepartments: 'كل الأقسام',
    itemType: 'النوع',
    typePassFail: 'ناجح / راسب',
    typeYesno: 'نعم / لا',
    typeText: 'نص حر',
    typeNumber: 'رقم',
    placeCreated: 'تم إنشاء المكان',
    placeSaved: 'تم حفظ المكان',

    // departments
    newDepartment: 'قسم جديد',
    departmentNameAr: 'الاسم (عربي)',
    departmentNameEn: 'الاسم (إنجليزي)',

    // users
    newStaff: 'موظف جديد',
    name: 'الاسم',
    phone: 'رقم الهاتف',
    phoneHint: '١٠ أرقام بدون الصفر — مثال 1012345678',
    phoneInvalid: 'رقم الهاتف يجب أن يكون ١٠ أرقام.',
    role: 'الدور',
    changeRole: 'تغيير الدور',
    changeDepartment: 'تغيير القسم',
    manager: 'المشرف',
    changeManager: 'تغيير المشرف',
    noManager: 'بدون مشرف',
    noDepartment: 'بدون قسم',
    staffCreated: 'تم إنشاء الحساب',
    passwordTooShort: 'كلمة المرور ٨ أحرف على الأقل.',
    adminOnly: 'هذه الصفحة للمديرين فقط.',
    serviceKeyMissing: 'مفتاح الخدمة غير مضبوط — أضف SUPABASE_SERVICE_ROLE_KEY في .env.local.',
    loginEmailPreview: 'بريد الدخول',
  },

  en: {
    appName: 'O House',
    appSubtitle: 'Admin portal',

    signIn: 'Sign in',
    email: 'Email',
    password: 'Password',
    signInButton: 'Sign in',
    signOut: 'Sign out',
    signInError: 'Incorrect email or password.',
    signInMissingFields: 'Enter your email and password.',
    notAuthorized: 'This account does not have access to the admin portal.',

    navAssignments: 'Assignments',
    navPlaces: 'Places',
    navUsers: 'Users',
    navDepartments: 'Departments',
    collapseSidebar: 'Collapse menu',
    expandSidebar: 'Expand menu',

    statusPending: 'Pending',
    statusInProgress: 'In progress',
    statusSubmitted: 'Submitted',
    statusApproved: 'Approved',
    statusRejected: 'Rejected',
    statusExpired: 'Expired',

    itemPending: 'Not done',
    itemDone: 'Done',
    itemRejected: 'Rejected',

    roleAdmin: 'Admin',
    roleManager: 'Manager',
    roleInspector: 'Inspector',
    roleCleaner: 'Cleaner',

    loading: 'Loading…',
    noData: 'No data',
    status: 'Status',
    subtasks: 'Subtasks',
    back: 'Back',
    place: 'Place',
    assignee: 'Assignee',
    date: 'Date',
    window: 'Window',
    deadline: 'Deadline',
    progress: 'Progress',
    signature: 'Signature',
    photo: 'Photo',
    note: 'Note',
    rejectReason: 'Rejection reason',
    requiresPhoto: 'Photo required',
    extended: 'Extended',
    language: 'عربي',
    save: 'Save',
    cancel: 'Cancel',
    create: 'Create',
    edit: 'Edit',
    remove: 'Delete',
    confirmDelete: 'Delete this?',
    saved: 'Saved',
    errorGeneric: 'Something went wrong. Try again.',
    optional: 'optional',
    none: '—',
    actions: 'Actions',

    newAssignment: 'New assignment',
    assignmentTitleAr: 'Title (Arabic)',
    assignmentTitleEn: 'Title (English)',
    scheduledDate: 'Date',
    windowStart: 'From',
    windowEnd: 'To',
    selectPlace: 'Select a place',
    selectAssignee: 'Select a staff member',
    subtasksFromPlace: "Subtasks come from the place — edit them as you like.",
    addSubtask: 'Add subtask',
    subtaskAr: 'Text (Arabic)',
    subtaskEn: 'Text (English)',
    critical: 'Critical',
    assignmentCreated: 'Assignment created',
    fieldsRequired: 'Fill in the required fields.',
    missingFields: 'Missing:',
    required: 'Required',
    placeHasNoSite: 'This place has no linked site, so it cannot be assigned. Edit and save it again.',
    needAtLeastOneSubtask: 'Add at least one subtask.',
    subtaskNeedsText: 'Every subtask needs text in Arabic or English.',

    approve: 'Approve',
    reject: 'Reject items',
    extend: 'Extend',
    newDeadline: 'New deadline',
    extensionNote: 'Reason for extension',
    selectItemsToReject: 'Select the items to reject',
    reasonRequired: 'Give a reason for the rejection.',
    noItemsSelected: 'No items selected.',
    notInSubmittedState: 'This assignment is not awaiting review.',
    alreadyClosed: 'This assignment is closed and cannot be extended.',
    deadlineMustBeFuture: 'The new deadline must be in the future.',
    reviewNote: 'Review note',

    newPlace: 'New place',
    placeNameAr: 'Name (Arabic)',
    placeNameEn: 'Name (English)',
    defaultSubtasks: 'Default subtasks',
    itemsCount: 'Subtasks',
    department: 'Department',
    allDepartments: 'All departments',
    itemType: 'Type',
    typePassFail: 'Pass / Fail',
    typeYesno: 'Yes / No',
    typeText: 'Free text',
    typeNumber: 'Number',
    placeCreated: 'Place created',
    placeSaved: 'Place saved',

    newDepartment: 'New department',
    departmentNameAr: 'Name (Arabic)',
    departmentNameEn: 'Name (English)',

    newStaff: 'New staff member',
    name: 'Name',
    phone: 'Phone number',
    phoneHint: '10 digits, no leading zero — e.g. 1012345678',
    phoneInvalid: 'The phone number must be exactly 10 digits.',
    role: 'Role',
    changeRole: 'Change role',
    changeDepartment: 'Change department',
    manager: 'Manager',
    changeManager: 'Change manager',
    noManager: 'No manager',
    noDepartment: 'No department',
    staffCreated: 'Account created',
    passwordTooShort: 'Password must be at least 8 characters.',
    adminOnly: 'This page is for admins only.',
    serviceKeyMissing: 'Service key not set — add SUPABASE_SERVICE_ROLE_KEY to .env.local.',
    loginEmailPreview: 'Login email',
  },
} as const;

/** Keys come from `en`; values widen to string, otherwise `as const` makes
 *  every Arabic string a literal type that no English literal accepts. */
export type Dictionary = { readonly [K in keyof (typeof dictionaries)['en']]: string };

/** Compile-time assertion that every locale defines every key. */
const _exhaustive: Record<Locale, Dictionary> = dictionaries;
void _exhaustive;

export function isLocale(v: string | undefined | null): v is Locale {
  return v === 'ar' || v === 'en';
}

export function dir(locale: Locale): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

/**
 * Pick a bilingual column pair, falling back across languages. Mirrors
 * pickLocalized() in the Flutter app: rendering an empty string because the
 * Arabic column was never filled is worse than showing English.
 *
 * Lives here rather than in ./index because that module imports next/headers
 * and so cannot be pulled into a client component.
 */
export function bilingual(
  locale: Locale,
  ar: string | null | undefined,
  en: string | null | undefined,
): string {
  const preferred = locale === 'ar' ? ar : en;
  if (preferred) return preferred;
  return (locale === 'ar' ? en : ar) ?? '';
}
