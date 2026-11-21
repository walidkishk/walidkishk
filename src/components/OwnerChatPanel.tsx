import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Mail,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';
import {
  fetchAllOwnerChatThreadsFromServer,
  fetchOwnerChatMessagesFromServer,
  fetchUserOwnerChatThreadFromServer,
  isAppOwnerUser,
  isOwnerEmailOnly,
  isTransientFirestoreNetworkError,
  markOwnerChatRead,
  sendOwnerChatMessage,
  subscribeAllOwnerChatThreads,
  subscribeOwnerChatMessages,
  subscribeUserOwnerChatThread,
  type User,
} from '../firebase.ts';
import type { AuthUser, OwnerChatMessage, OwnerChatThread } from '../types.ts';

interface OwnerChatPanelProps {
  firebaseUser: User;
  user: AuthUser;
  onResendVerification: () => Promise<void>;
  onRefreshVerification: () => Promise<void>;
}

function formatChatTimeAr(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '';
  try {
    return new Intl.DateTimeFormat('ar-EG', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toLocaleTimeString();
  }
}

export function OwnerChatPanel({
  firebaseUser,
  user,
  onResendVerification,
  onRefreshVerification,
}: OwnerChatPanelProps) {
  const isOwnerEmail = isOwnerEmailOnly(user);
  const isVerifiedOwner = isAppOwnerUser(user);

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [userThread, setUserThread] = useState<OwnerChatThread | null>(null);
  const [allThreads, setAllThreads] = useState<OwnerChatThread[]>([]);
  const [selectedThreadUid, setSelectedThreadUid] = useState<string | null>(null);
  const [threadSearch, setThreadSearch] = useState<string>('');
  const [messages, setMessages] = useState<OwnerChatMessage[]>([]);
  const [draftText, setDraftText] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);
  const [refreshingChat, setRefreshingChat] = useState<boolean>(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [verifyingAction, setVerifyingAction] = useState<boolean>(false);
  const [verifyNotice, setVerifyNotice] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setChatError(null);
    if (isOwnerEmail) {
      if (!isVerifiedOwner) {
        setAllThreads([]);
        return;
      }
      const unsub = subscribeAllOwnerChatThreads(
        (list) => {
          setAllThreads(list);
          setSelectedThreadUid((prev) => {
            if (prev && list.some((t) => t.userId === prev)) return prev;
            return list[0]?.userId ?? null;
          });
        },
        (err) => {
          if (!isTransientFirestoreNetworkError(err)) {
            setChatError(err.message);
          }
        },
      );
      return () => unsub();
    }

    const unsub = subscribeUserOwnerChatThread(
      firebaseUser.uid,
      (thread) => setUserThread(thread),
      (err) => {
        if (!isTransientFirestoreNetworkError(err)) {
          setChatError(err.message);
        }
      },
    );
    return () => unsub();
  }, [firebaseUser.uid, isOwnerEmail, isVerifiedOwner]);

  const activeThreadUid = isOwnerEmail ? selectedThreadUid : firebaseUser.uid;

  useEffect(() => {
    if (!isOpen || !activeThreadUid) {
      setMessages([]);
      return;
    }
    if (isOwnerEmail && !isVerifiedOwner) {
      setMessages([]);
      return;
    }

    const unsub = subscribeOwnerChatMessages(
      activeThreadUid,
      (list) => setMessages(list),
      (err) => {
        if (!isTransientFirestoreNetworkError(err)) {
          setChatError(err.message);
        }
      },
    );
    return () => unsub();
  }, [activeThreadUid, isOpen, isOwnerEmail, isVerifiedOwner]);

  useEffect(() => {
    if (!isOpen || !activeThreadUid) return;
    if (isOwnerEmail) {
      if (!isVerifiedOwner) return;
      const target = allThreads.find((t) => t.userId === activeThreadUid);
      if (target?.unreadByOwner) {
        void markOwnerChatRead(firebaseUser, activeThreadUid, 'owner');
      }
    } else if (userThread?.unreadByUser) {
      void markOwnerChatRead(firebaseUser, activeThreadUid, 'user');
    }
  }, [
    activeThreadUid,
    allThreads,
    firebaseUser,
    isOpen,
    isOwnerEmail,
    isVerifiedOwner,
    userThread?.unreadByUser,
  ]);

  useEffect(() => {
    if (!isOpen || messages.length === 0) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [isOpen, messages.length]);

  const filteredThreads = useMemo(() => {
    const q = threadSearch.trim().toLowerCase();
    if (!q) return allThreads;
    return allThreads.filter(
      (t) =>
        t.userName.toLowerCase().includes(q) ||
        t.lastMessageText.toLowerCase().includes(q),
    );
  }, [allThreads, threadSearch]);

  const ownerUnreadCount = useMemo(
    () => allThreads.filter((t) => t.unreadByOwner).length,
    [allThreads],
  );

  const activeOwnerThread = useMemo(
    () => allThreads.find((t) => t.userId === selectedThreadUid) ?? null,
    [allThreads, selectedThreadUid],
  );

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    const text = draftText.trim();
    if (!text || !activeThreadUid) return;

    setChatError(null);
    setSending(true);
    try {
      await sendOwnerChatMessage({
        user: firebaseUser,
        threadUserId: activeThreadUid,
        threadUserEmail: isOwnerEmail
          ? activeOwnerThread?.userEmail || ''
          : user.email,
        threadUserName: isOwnerEmail
          ? activeOwnerThread?.userName || 'مستخدم'
          : user.displayName || 'مستخدم',
        text,
      });
      setDraftText('');
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'تعذر إرسال الرسالة حالياً.');
    } finally {
      setSending(false);
    }
  };

  const handleRefreshChat = async () => {
    if (refreshingChat) return;
    if (isOwnerEmail && !isVerifiedOwner) return;
    setChatError(null);
    setRefreshingChat(true);
    try {
      if (isOwnerEmail) {
        const freshThreads = await fetchAllOwnerChatThreadsFromServer();
        setAllThreads(freshThreads);
        const targetUid =
          selectedThreadUid && freshThreads.some((t) => t.userId === selectedThreadUid)
            ? selectedThreadUid
            : freshThreads[0]?.userId ?? null;
        if (targetUid !== selectedThreadUid) {
          setSelectedThreadUid(targetUid);
        }
        if (isOpen && targetUid) {
          const freshMessages = await fetchOwnerChatMessagesFromServer(targetUid);
          setMessages(freshMessages);
        }
      } else {
        const freshThread = await fetchUserOwnerChatThreadFromServer(firebaseUser.uid);
        setUserThread(freshThread);
        if (isOpen) {
          const freshMessages = await fetchOwnerChatMessagesFromServer(firebaseUser.uid);
          setMessages(freshMessages);
        }
      }
    } catch (err) {
      if (!isTransientFirestoreNetworkError(err)) {
        setChatError(err instanceof Error ? err.message : 'تعذر تحديث المحادثة حالياً.');
      }
    } finally {
      setRefreshingChat(false);
    }
  };

  const hasUnreadBadge = isOwnerEmail ? ownerUnreadCount > 0 : Boolean(userThread?.unreadByUser);
  const currentUserLabel = user.displayName || 'مستخدم';

  return (
    <section
      aria-label="محادثة المالك"
      className="mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-[#09090b] lg:max-w-3xl"
    >
      {/* Collapsible Menu Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-3 sm:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            {hasUnreadBadge && (
              <span
                aria-hidden="true"
                className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#09090b]"
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h2 className="truncate text-sm font-bold text-slate-900 dark:text-white">
                محادثة المالك
              </h2>
              {isOwnerEmail && ownerUnreadCount > 0 && (
                <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums">
                  {ownerUnreadCount} جديد
                </span>
              )}
              {!isOwnerEmail && userThread?.unreadByUser && (
                <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  رد جديد
                </span>
              )}
            </div>
            <p className="truncate text-[11px] text-slate-500 dark:text-zinc-400">
              {isOwnerEmail
                ? `${allThreads.length} محادثة من حسابات المستخدمين`
                : `تواصل مباشر من حسابك (${currentUserLabel}) مع المالك`}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            disabled={refreshingChat || (isOwnerEmail && !isVerifiedOwner)}
            onClick={() => void handleRefreshChat()}
            title="تحديث المحادثة"
            aria-label="تحديث المحادثة"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 transition-colors hover:border-emerald-500 hover:text-emerald-600 disabled:opacity-50 dark:border-zinc-800 dark:bg-black dark:text-zinc-200 dark:hover:border-emerald-500 dark:hover:text-emerald-400"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${refreshingChat ? 'animate-spin text-emerald-600 dark:text-emerald-400' : ''}`}
              aria-hidden="true"
            />
          </button>

          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            aria-expanded={isOpen}
            className="inline-flex min-h-[38px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-500"
          >
            <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              {isOpen
                ? 'إخفاء'
                : isOwnerEmail && allThreads.length > 0
                  ? `محادثة المالك (${allThreads.length})`
                  : 'محادثة المالك'}
            </span>
            {isOpen ? (
              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Expandable Direct Chat Content */}
      {isOpen && (
        <div className="border-t border-slate-200 p-2.5 sm:p-4 dark:border-zinc-800">
          {isOwnerEmail && !isVerifiedOwner ? (
            <div className="rounded-xl border border-amber-500/40 bg-amber-50 p-3.5 text-xs dark:bg-amber-950/25">
              <div className="flex items-start gap-2.5 text-amber-900 dark:text-amber-200">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                <div className="min-w-0 space-y-1">
                  <p className="font-bold">
                    يلزم تأكيد حساب المالك لفتح قائمة محادثات المستخدمين
                  </p>
                  <p className="leading-relaxed">
                    لحماية خصوصية رسائل المستخدمين، يتطلب عرض الرسائل والرد عليها تأكيد البريد الإلكتروني مرة واحدة.
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={verifyingAction}
                  onClick={async () => {
                    setVerifyingAction(true);
                    setVerifyNotice(null);
                    try {
                      await onResendVerification();
                      setVerifyNotice('تم إرسال رابط التأكيد إلى بريدك. اضغط «تحديث حالة التأكيد» بعد فتح الرابط.');
                    } catch (err) {
                      setVerifyNotice(err instanceof Error ? err.message : 'تعذر إرسال رابط التأكيد');
                    } finally {
                      setVerifyingAction(false);
                    }
                  }}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-60"
                >
                  <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>إرسال رابط التأكيد</span>
                </button>
                <button
                  type="button"
                  disabled={verifyingAction}
                  onClick={async () => {
                    setVerifyingAction(true);
                    setVerifyNotice(null);
                    try {
                      await onRefreshVerification();
                    } catch (err) {
                      setVerifyNotice(err instanceof Error ? err.message : 'تعذر تحديث الحالة');
                    } finally {
                      setVerifyingAction(false);
                    }
                  }}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-amber-500/50 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60 dark:bg-black dark:text-amber-200"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${verifyingAction ? 'animate-spin' : ''}`} aria-hidden="true" />
                  <span>تحديث حالة التأكيد</span>
                </button>
              </div>
              {verifyNotice && (
                <p className="mt-2 font-semibold text-amber-800 dark:text-amber-300">{verifyNotice}</p>
              )}
            </div>
          ) : (
            <div className={isOwnerEmail ? 'grid grid-cols-1 gap-3 lg:grid-cols-12' : 'w-full'}>
              {/* Owner Threads List (shows Usernames, not emails) */}
              {isOwnerEmail && (
                <div
                  className={`min-w-0 space-y-2 lg:col-span-5 ${
                    selectedThreadUid ? 'hidden lg:block' : 'block'
                  }`}
                >
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                      aria-hidden="true"
                    />
                    <input
                      type="search"
                      value={threadSearch}
                      onChange={(e) => setThreadSearch(e.target.value)}
                      placeholder="بحث باسم المستخدم أو الرسالة..."
                      className="min-h-[38px] w-full min-w-0 rounded-lg border border-slate-300 bg-slate-50 pr-8 pl-3 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-800 dark:bg-black dark:text-zinc-100"
                    />
                  </div>

                  {filteredThreads.length === 0 ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500 dark:border-zinc-800 dark:bg-black dark:text-zinc-400">
                      {allThreads.length === 0
                        ? 'لا توجد محادثات من المستخدمين حتى الآن.'
                        : 'لا توجد نتائج مطابقة.'}
                    </div>
                  ) : (
                    <div className="max-h-[min(52dvh,380px)] space-y-1.5 overflow-y-auto overscroll-contain">
                      {filteredThreads.map((t) => {
                        const isSelected = t.userId === selectedThreadUid;
                        const displayName = t.userName || 'مستخدم';
                        return (
                          <button
                            key={t.userId}
                            type="button"
                            onClick={() => setSelectedThreadUid(t.userId)}
                            className={`w-full min-w-0 rounded-lg border p-2.5 text-right transition-colors ${
                              isSelected
                                ? 'border-emerald-500 bg-emerald-500/10'
                                : 'border-slate-200 bg-slate-50/70 hover:border-emerald-500/50 dark:border-zinc-800 dark:bg-black'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate text-xs font-bold text-slate-900 dark:text-white">
                                {displayName}
                              </span>
                              {t.unreadByOwner && (
                                <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                              )}
                            </div>
                            <p className="mt-1 truncate text-[11px] text-slate-600 dark:text-zinc-400">
                              {t.lastSenderRole === 'owner' ? 'أنت: ' : ''}
                              {t.lastMessageText}
                            </p>
                            <p className="mt-1 text-[10px] text-slate-400 dark:text-zinc-500">
                              {formatChatTimeAr(t.lastMessageAtIso)}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Active 1-to-1 Conversation sized cleanly for both mobile and desktop screens */}
              <div
                className={
                  isOwnerEmail
                    ? `min-w-0 lg:col-span-7 ${selectedThreadUid ? 'block' : 'hidden lg:block'}`
                    : 'min-w-0 w-full'
                }
              >
                {isOwnerEmail && !selectedThreadUid ? (
                  <div className="flex h-[min(55dvh,380px)] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500 dark:border-zinc-800 dark:bg-black dark:text-zinc-400">
                    اختر محادثة من القائمة لعرض الرسائل والرد مباشرة على المستخدم.
                  </div>
                ) : (
                  <div className="flex h-[min(60dvh,430px)] w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50/60 dark:border-zinc-800 dark:bg-black">
                    {/* Thread Header */}
                    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-[#09090b]">
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        {isOwnerEmail && (
                          <button
                            type="button"
                            onClick={() => setSelectedThreadUid(null)}
                            aria-label="العودة إلى قائمة المحادثات"
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 lg:hidden dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                          >
                            <ArrowRight className="h-4 w-4" aria-hidden="true" />
                          </button>
                        )}
                        {isOwnerEmail ? (
                          <UserIcon className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                        ) : (
                          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-slate-900 dark:text-white">
                            {isOwnerEmail
                              ? activeOwnerThread?.userName || 'مستخدم'
                              : 'المالك'}
                          </p>
                          <p className="truncate text-[10px] text-slate-500 dark:text-zinc-400">
                            {isOwnerEmail
                              ? 'رد مباشر من حساب المالك'
                              : `أنت متحدث باسم: ${currentUserLabel}`}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Messages Scroll Area */}
                    <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain p-3">
                      {messages.length === 0 ? (
                        <div className="flex h-full items-center justify-center px-3 text-center text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
                          {isOwnerEmail
                            ? 'لا توجد رسائل في هذه المحادثة بعد.'
                            : 'ابدأ المحادثة بكتابة رسالتك للمالك أدناه — ستصله فوراً وسيظهر لك رده هنا.'}
                        </div>
                      ) : (
                        messages.map((msg) => {
                          const isMine = isOwnerEmail
                            ? msg.senderRole === 'owner'
                            : msg.senderRole === 'user';
                          const senderLabel =
                            msg.senderRole === 'owner'
                              ? 'المالك'
                              : isMine
                                ? currentUserLabel
                                : activeOwnerThread?.userName || 'المستخدم';
                          return (
                            <div
                              key={msg.id}
                              className={`flex flex-col ${isMine ? 'items-start' : 'items-end'}`}
                            >
                              <div
                                className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed sm:max-w-[78%] ${
                                  isMine
                                    ? 'bg-emerald-600 text-white'
                                    : 'border border-slate-200 bg-white text-slate-900 dark:border-zinc-800 dark:bg-[#09090b] dark:text-zinc-100'
                                }`}
                              >
                                <div className="mb-1 flex flex-wrap items-center gap-2 text-[10px] opacity-85">
                                  <span className="font-bold">{senderLabel}</span>
                                  <span>{formatChatTimeAr(msg.createdAtIso)}</span>
                                </div>
                                <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                              </div>
                            </div>
                          );
                        })
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    {chatError && (
                      <p role="alert" className="shrink-0 px-3 pb-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
                        {chatError}
                      </p>
                    )}

                    {/* Message Input Form */}
                    <form
                      onSubmit={handleSend}
                      className="flex shrink-0 items-center gap-2 border-t border-slate-200 bg-white p-2 dark:border-zinc-800 dark:bg-[#09090b]"
                    >
                      <input
                        type="text"
                        maxLength={1500}
                        value={draftText}
                        onChange={(e) => setDraftText(e.target.value)}
                        placeholder={
                          isOwnerEmail ? 'اكتب ردك للمستخدم...' : 'اكتب رسالتك للمالك...'
                        }
                        className="min-h-[40px] min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-800 dark:bg-black dark:text-zinc-100 sm:text-xs"
                      />
                      <button
                        type="submit"
                        disabled={sending || !draftText.trim()}
                        className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
                      >
                        <Send className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{sending ? '...' : 'إرسال'}</span>
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
