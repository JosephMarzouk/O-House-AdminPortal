/**
 * Arabic is the default — the club's staff work in it, and the old portal
 * shipped ar-first. Keys are added as screens land rather than ported
 * wholesale; the old portal's 165-key table is the reference for wording.
 *
 * Register note: the Flutter app's Arabic is fairly standard MSA, while the
 * old web portal used Egyptian colloquial. This follows the app, since staff
 * see both and the app is the one they use daily.
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

    // assignment statuses (assignments_v.effective_status)
    statusPending: 'قيد الانتظار',
    statusInProgress: 'قيد التنفيذ',
    statusSubmitted: 'تم الإرسال',
    statusApproved: 'معتمدة',
    statusRejected: 'مرفوضة',
    statusExpired: 'منتهية',

    // item statuses
    itemPending: 'لم تُنفَّذ',
    itemDone: 'تم',
    itemRejected: 'مرفوضة',

    // roles
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
  },
} as const;

/** Keys come from `en`; values widen to string, otherwise `as const` makes
 *  every Arabic string a literal type that no English literal accepts. */
export type Dictionary = { readonly [K in keyof (typeof dictionaries)['en']]: string };

/** Compile-time assertion that every locale defines every key. Adding a key
 *  to `en` and forgetting it in `ar` is a build error, not a runtime blank. */
const _exhaustive: Record<Locale, Dictionary> = dictionaries;
void _exhaustive;

export function isLocale(v: string | undefined | null): v is Locale {
  return v === 'ar' || v === 'en';
}

export function dir(locale: Locale): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}
