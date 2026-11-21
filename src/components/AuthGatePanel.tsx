import { useState, type FormEvent } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogIn,
  LogOut,
  Mail,
  RefreshCw,
  ShieldCheck,
  User as UserIcon,
  UserPlus,
} from 'lucide-react';
import { useInAppBrowser } from '../context/InAppBrowserContext.tsx';
import type { AuthUser } from '../types.ts';

interface AuthGatePanelProps {
  user: AuthUser | null;
  authLoading: boolean;
  onLogin: (email: string, password: string, username?: string) => Promise<void>;
  onRegister: (email: string, password: string, username?: string) => Promise<void>;
  onResetPassword: (email: string) => Promise<void>;
  onResendVerification: () => Promise<void>;
  onRefreshVerification: () => Promise<void>;
  onLogout: () => Promise<void>;
}

const FIREBASE_AUTH_PROVIDERS_URL =
  'https://console.firebase.google.com/project/carbide-pen-tpd8p/authentication/providers';

export function AuthGatePanel({
  user,
  authLoading,
  onLogin,
  onRegister,
  onResetPassword,
  onResendVerification,
  onRefreshVerification,
  onLogout,
}: AuthGatePanelProps) {
  const { openInAppUrl } = useInAppBrowser();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [resetting, setResetting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProviderDisabledError, setIsProviderDisabledError] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsProviderDisabledError(false);
    setSuccessMsg(null);

    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim();

    if (!trimmedUsername || trimmedUsername.length < 2) {
      setErrorMsg('يرجى إدخال اسم المستخدم (حرفين على الأقل).');
      return;
    }
    if (!trimmedEmail) {
      setErrorMsg('يرجى إدخال البريد الإلكتروني أولاً.');
      return;
    }

    if (mode === 'register' && confirmPassword !== password) {
      setErrorMsg('كلمتا المرور غير متطابقتين. يرجى التأكد وإعادة المحاولة.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'login') {
        await onLogin(trimmedEmail, password, trimmedUsername);
        setSuccessMsg('تم تسجيل الدخول بنجاح وجاري مزامنة حساباتك.');
      } else {
        await onRegister(trimmedEmail, password, trimmedUsername);
        setSuccessMsg('تم إنشاء حسابك بنجاح! يمكنك الآن استخدام جميع أقسام التطبيق.');
      }
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تعذر إتمام العملية';
      if (
        msg.includes('Email/Password') ||
        msg.includes('operation-not-allowed') ||
        msg.includes('PASSWORD_LOGIN_DISABLED') ||
        msg.includes('غير مفعّل')
      ) {
        setIsProviderDisabledError(true);
      }
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPasswordClick = async () => {
    setErrorMsg(null);
    setIsProviderDisabledError(false);
    setSuccessMsg(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMsg('أدخل بريدك الإلكتروني أولاً لنرسل لك رابط إعادة تعيين كلمة المرور.');
      return;
    }
    setResetting(true);
    try {
      await onResetPassword(trimmedEmail);
      setSuccessMsg('تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تعذر إرسال رابط إعادة تعيين كلمة المرور';
      if (
        msg.includes('Email/Password') ||
        msg.includes('operation-not-allowed') ||
        msg.includes('غير مفعّل')
      ) {
        setIsProviderDisabledError(true);
      }
      setErrorMsg(msg);
    } finally {
      setResetting(false);
    }
  };

  const handleResend = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmitting(true);
    try {
      await onResendVerification();
      setSuccessMsg('تم إرسال رابط تأكيد البريد الإلكتروني (اختياري).');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذر إرسال رابط التفعيل');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefresh = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmitting(true);
    try {
      await onRefreshVerification();
      setSuccessMsg('تم تحديث حالة الحساب.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذر تحديث الحالة');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <section
        id="app-auth"
        className="mx-auto h-64 w-full max-w-md animate-pulse rounded-2xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#09090b]"
      />
    );
  }

  if (user) {
    return (
      <section
        id="app-auth"
        className="mx-auto w-full max-w-xl space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 dark:border-zinc-800 dark:bg-[#09090b]"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" aria-hidden="true" />
              <h2 className="text-sm font-bold text-slate-950 sm:text-base dark:text-white">
                جلسة تسجيل دخول نشطة
              </h2>
              <span className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                {user.providerId === 'google.com' ? 'حساب Google' : 'حساب مسجل'}
              </span>
            </div>

            <p className="text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
              اسم المستخدم:{' '}
              <span className="font-bold text-slate-900 dark:text-white">
                {user.displayName}
              </span>
            </p>

            <p className="break-all text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
              البريد الإلكتروني:{' '}
              <span className="font-mono font-semibold text-slate-800 dark:text-zinc-200" dir="ltr">
                {user.email}
              </span>
            </p>
          </div>

          <button
            type="button"
            onClick={() => void onLogout()}
            className="inline-flex min-h-[42px] w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 sm:w-auto dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span>تسجيل الخروج</span>
          </button>
        </div>

        {!user.emailVerified && (
          <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-slate-50 p-3.5 text-xs sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-black">
            <div className="flex items-start gap-2 text-slate-600 dark:text-zinc-400">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
              <span className="leading-relaxed">
                حسابك يعمل بكامل صلاحياته الآن. يمكنك اختيارياً تأكيد البريد الإلكتروني:
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleResend()}
                className="inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>إرسال التأكيد</span>
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleRefresh()}
                className="inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 shrink-0 ${submitting ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                <span>تحديث</span>
              </button>
            </div>
          </div>
        )}

        {(errorMsg || successMsg) && (
          <div className="space-y-1.5">
            {errorMsg && (
              <p role="alert" className="text-xs leading-relaxed font-semibold text-rose-600 dark:text-rose-400">
                {errorMsg}
              </p>
            )}
            {successMsg && (
              <p role="status" className="text-xs leading-relaxed font-semibold text-emerald-600 dark:text-emerald-400">
                {successMsg}
              </p>
            )}
          </div>
        )}
      </section>
    );
  }

  return (
    <section
      id="app-auth"
      className="mx-auto w-full max-w-md space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:border-zinc-800 dark:bg-[#09090b]"
    >
      <div className="space-y-1.5 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <KeyRound className="h-5 w-5" aria-hidden="true" />
        </div>
        <h2 className="text-base font-bold text-slate-950 sm:text-lg dark:text-white">
          تسجيل الدخول إلى VPN Fastore Pro
        </h2>
        <p className="text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
          جميع خيارات وأقسام التطبيق مغلقة لحين تسجيل الدخول باسم المستخدم والبريد الإلكتروني وكلمة السر أو إنشاء حساب جديد
        </p>
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-zinc-800 dark:bg-black">
        <button
          type="button"
          onClick={() => {
            setMode('login');
            setErrorMsg(null);
            setSuccessMsg(null);
            setIsProviderDisabledError(false);
          }}
          className={`flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors ${
            mode === 'login'
              ? 'bg-white text-slate-950 shadow-sm dark:bg-zinc-900 dark:text-white'
              : 'text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white'
          }`}
        >
          <LogIn className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>تسجيل الدخول</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('register');
            setErrorMsg(null);
            setSuccessMsg(null);
            setIsProviderDisabledError(false);
          }}
          className={`flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors ${
            mode === 'register'
              ? 'bg-white text-slate-950 shadow-sm dark:bg-zinc-900 dark:text-white'
              : 'text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white'
          }`}
        >
          <UserPlus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>حساب جديد</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <label
            htmlFor="app-login-username"
            className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
          >
            اسم المستخدم
          </label>
          <div className="relative">
            <UserIcon
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
              aria-hidden="true"
            />
            <input
              id="app-login-username"
              type="text"
              autoComplete="username"
              required
              minLength={2}
              maxLength={80}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="اكتب اسم المستخدم الذي يظهر للآخرين"
              className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white py-2 pr-3 pl-9 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-800 dark:bg-black dark:text-zinc-100"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="app-login-email"
            className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
          >
            البريد الإلكتروني
          </label>
          <div className="relative">
            <Mail
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
              aria-hidden="true"
            />
            <input
              id="app-login-email"
              type="email"
              autoComplete="email"
              required
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white py-2 pr-3 pl-9 font-mono text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-800 dark:bg-black dark:text-zinc-100"
            />
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label
              htmlFor="app-login-password"
              className="block text-xs font-semibold text-slate-700 dark:text-zinc-300"
            >
              كلمة السر {mode === 'register' ? '(6 أحرف على الأقل)' : ''}
            </label>
            {mode === 'login' && (
              <button
                type="button"
                disabled={resetting}
                onClick={() => void handleResetPasswordClick()}
                className="text-[11px] font-medium text-emerald-600 hover:underline disabled:opacity-60 dark:text-emerald-400"
              >
                {resetting ? 'جارٍ الإرسال...' : 'نسيت كلمة السر؟'}
              </button>
            )}
          </div>
          <div className="relative">
            <Lock
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
              aria-hidden="true"
            />
            <input
              id="app-login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={6}
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white py-2 pr-10 pl-9 font-mono text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-800 dark:bg-black dark:text-zinc-100"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'إخفاء كلمة السر' : 'إظهار كلمة السر'}
              className="absolute right-2.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {mode === 'register' && (
          <div>
            <label
              htmlFor="app-register-confirm-password"
              className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-zinc-300"
            >
              تأكيد كلمة السر
            </label>
            <div className="relative">
              <Lock
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
                aria-hidden="true"
              />
              <input
                id="app-register-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                minLength={6}
                dir="ltr"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••"
                className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white py-2 pr-10 pl-9 font-mono text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-800 dark:bg-black dark:text-zinc-100"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                aria-label={showConfirmPassword ? 'إخفاء تأكيد كلمة السر' : 'إظهار تأكيد كلمة السر'}
                className="absolute right-2.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-60"
        >
          {mode === 'login' ? (
            <>
              <LogIn className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{submitting ? 'جارٍ تسجيل الدخول...' : 'تسجيل الدخول'}</span>
            </>
          ) : (
            <>
              <UserPlus className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{submitting ? 'جارٍ إنشاء الحساب...' : 'إنشاء الحساب'}</span>
            </>
          )}
        </button>

        {(errorMsg || successMsg) && (
          <div className="space-y-3">
            {errorMsg && (
              <p
                role="alert"
                className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs leading-relaxed font-semibold text-rose-600 dark:text-rose-400"
              >
                {errorMsg}
              </p>
            )}
            {isProviderDisabledError && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-50 p-3.5 text-xs leading-relaxed text-amber-900 dark:bg-amber-950/25 dark:text-amber-200">
                <p className="font-bold text-amber-700 dark:text-amber-300">
                  خطوة مطلوبة لتشغيل تسجيل البريد وكلمة السر من لوحة Firebase:
                </p>
                <ol className="mt-2 list-inside list-decimal space-y-1">
                  <li>
                    افتح مزوّدات المصادقة في مشروع{' '}
                    <code dir="ltr" className="font-mono font-semibold">
                      carbide-pen-tpd8p
                    </code>
                    .
                  </li>
                  <li>
                    اختر <strong>Email/Password</strong> ثم فعّل <strong>Enable</strong> واضغط{' '}
                    <strong>Save</strong>.
                  </li>
                  <li>ارجع هنا وأعد الضغط على زر الدخول أو إنشاء الحساب.</li>
                </ol>
                <button
                  type="button"
                  onClick={() => openInAppUrl(FIREBASE_AUTH_PROVIDERS_URL, { title: 'Firebase Console' })}
                  className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-500/50 bg-white px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 dark:bg-black dark:text-amber-300 dark:hover:bg-amber-950/40"
                >
                  <span>فتح Firebase Console لتفعيل Email/Password</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                </button>
              </div>
            )}
            {successMsg && (
              <p
                role="status"
                className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs leading-relaxed font-semibold text-emerald-700 dark:text-emerald-300"
              >
                {successMsg}
              </p>
            )}
          </div>
        )}
      </form>
    </section>
  );
}
