/* ============================================================
   CallBiz Manager – נתונים, קונפיגורציה ומנוע Workflow
   מבוסס על מסמך האפיון המלא
   ============================================================ */

/* ---------- אייקוני SVG (inline) ---------- */
const ICONS = {
  home:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>',
  leads:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M17 8h4M19 6v4"/></svg>',
  calendar:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9h18M8 2.5v4M16 2.5v4"/></svg>',
  tasks:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/></svg>',
  phone:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5c0 8 7 15 15 15l2.5-3.2-4.2-2.3-2 2c-2.6-1.2-4.8-3.4-6-6l2-2L9 4.5 5.8 4C5 4 4 4.3 4 5Z"/></svg>',
  whatsapp:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2Zm5.3 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-3.2-.8-2.7-1.1-4.4-3.9-4.5-4.1-.1-.2-1.1-1.4-1.1-2.7 0-1.3.7-1.9.9-2.2.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2 0 .4-.1.6l-.4.5c-.2.2-.3.4-.1.7.2.3.9 1.4 1.9 2.3 1.3 1.1 2.3 1.5 2.6 1.6.2.1.4.1.6-.1l.9-1c.2-.2.4-.2.6-.1l1.9.9c.2.1.4.2.4.4.1.2.1.7-.1 1.3Z"/></svg>',
  mail:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4 7 8 5 8-5"/></svg>',
  docs:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/></svg>',
  clients: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.3"/><path d="M2 20c0-3 2.7-5 6-5s6 2 6 5M14.5 20c0-2 1.5-3.5 4-3.5s3.5 1.5 3.5 3.5"/></svg>',
  reports: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20V4M20 20H4M8 16v-4M12 16V8M16 16v-6"/></svg>',
  settings:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></svg>',
  plus:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>',
  chevronL:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 6-6 6 6 6"/></svg>',
  chevronR:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 6 6 6-6 6"/></svg>',
  filter:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 5h18l-7 8v6l-4-2v-4z"/></svg>',
  search:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  check:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m5 12 5 5 9-11"/></svg>',
  close:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  clock:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  user:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6"/></svg>',
  history: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></svg>',
  kebab:   '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/></svg>',
  video:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3z"/></svg>',
  bolt:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>',
  note:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4h16v12l-4 4H4z"/><path d="M16 20v-4h4"/></svg>',
  alert:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3 2 20h20z"/><path d="M12 9v5M12 17h.01"/></svg>',
  flag:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>',
  pause:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
  layers:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/></svg>',
  target:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></svg>',
  queue:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
  sync:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 9a8 8 0 0 1 13-3l3 3M20 15a8 8 0 0 1-13 3l-3-3"/><path d="M17 3v6h-6M7 21v-6h6"/></svg>',
  eye:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="2.6"/></svg>',
  expand:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>',
};

/* ============================================================
   4. סוג ישות / מסלול טיפול / מטרה (הפרדה מחייבת)
   ============================================================ */
const ENTITY_TYPES = {
  lead:      { label: 'ליד',          color: 'blue'  },
  prospect:  { label: 'מתעניין',      color: 'blue'  },
  customer:  { label: 'לקוח פעיל',    color: 'green' },
  former:    { label: 'לקוח לשעבר',   color: 'gray'  },
  contact:   { label: 'איש קשר',      color: 'gray'  },
  org:       { label: 'ארגון',        color: 'gray'  },
};

const JOURNEY_TYPES = {
  sales:        { label: 'מכירה',        color: 'blue'   },
  support:      { label: 'שירות',        color: 'amber'  },
  upsell:       { label: 'הרחבת שירות',  color: 'blue'   },
  retention:    { label: 'שימור',        color: 'orange' },
  renewal:      { label: 'חידוש',        color: 'green'  },
  installation: { label: 'התקנה',        color: 'blue'   },
  training:     { label: 'הדרכה',        color: 'blue'   },
  billing:      { label: 'גבייה',        color: 'red'    },
  complaint:    { label: 'תלונה',        color: 'red'    },
  cancellation: { label: 'ביטול',        color: 'red'    },
  general:      { label: 'שירות כללי',   color: 'amber'  },
  appointment:  { label: 'תיאום',        color: 'green'  },
  followup:     { label: 'פולו-אפ',      color: 'orange' },
};

const OBJECTIVES = {
  contact:    'יצירת קשר',
  meeting:    'קביעת פגישה',
  resolve:    'פתרון תקלה',
  schedule:   'תיאום שירות',
  proposal:   'שליחת הצעה',
  document:   'קבלת מסמך',
  renew:      'חידוש חוזה',
  collect:    'גביית תשלום',
  close:      'סגירת פנייה',
  winback:    'החזרת לקוח',
  training:   'ביצוע הדרכה',
  install:    'תיאום התקנה',
};

/* ============================================================
   8. מצבי שלב ב-Workflow
   ============================================================ */
const STAGE_STATE = {
  done:       { label: 'הושלם',        color: 'green',  icon: 'check' },
  active:     { label: 'פעיל',         color: 'brand',  icon: 'clock' },
  waiting:    { label: 'ממתין',        color: 'amber',  icon: 'pause' },
  overdue:    { label: 'באיחור',       color: 'red',    icon: 'alert' },
  blocked:    { label: 'חסום',         color: 'red',    icon: 'alert' },
  cancelled:  { label: 'בוטל',         color: 'gray',   icon: 'close' },
  irrelevant: { label: 'לא רלוונטי',   color: 'gray',   icon: 'close' },
  todo:       { label: 'טרם התחיל',    color: 'gray',   icon: '' },
};

/* ============================================================
   6 + 8.4  מנוע Workflow דינמי – שלבים לפי מסלול טיפול
   (לא קשיח בממשק – מוגדר בקונפיג, ניתן להוסיף מסלולים)
   ============================================================ */
const WORKFLOWS = {
  sales: [
    { key: 'intake',      title: 'ליד נכנס',       objective: 'contact' },
    { key: 'assign',      title: 'שיוך לנציג',     objective: 'contact' },
    { key: 'contactinfo', title: 'פרטי איש קשר',   objective: 'contact' },
    { key: 'contact',     title: 'יצירת קשר',      objective: 'contact' },
    { key: 'qualify',     title: 'סיווג צורך',     objective: 'meeting' },
    { key: 'meeting',   title: 'קביעת פגישה',     objective: 'meeting' },
    { key: 'reminder',  title: 'תזכורות לפגישה',  objective: 'meeting' },
    { key: 'held',      title: 'ביצוע פגישה',     objective: 'proposal' },
    { key: 'summary',   title: 'סיכום פגישה',     objective: 'proposal' },
    { key: 'proposal',  title: 'שליחת הצעת מחיר', objective: 'proposal' },
    { key: 'followup',  title: 'פולו-אפ',         objective: 'close' },
    { key: 'close',     title: 'סגירה (זכייה/הפסד)', objective: 'close' },
  ],
  support: [
    { key: 'open',      title: 'פתיחת פנייה',       objective: 'resolve' },
    { key: 'identify',  title: 'זיהוי לקוח',        objective: 'resolve' },
    { key: 'classify',  title: 'סיווג פנייה',       objective: 'resolve' },
    { key: 'diagnose',  title: 'אבחון',             objective: 'resolve' },
    { key: 'log',       title: 'תיעוד',             objective: 'resolve' },
    { key: 'schedule',  title: 'תיאום טיפול / תור', objective: 'schedule' },
    { key: 'handle',    title: 'טיפול',             objective: 'resolve' },
    { key: 'waitcust',  title: 'המתנה ללקוח',       objective: 'resolve' },
    { key: 'verify',    title: 'בדיקת פתרון',       objective: 'close' },
    { key: 'csat',      title: 'שביעות רצון',       objective: 'close' },
    { key: 'close',     title: 'סגירה',             objective: 'close' },
  ],
  upsell: [
    { key: 'request',   title: 'בקשת הרחבה',   objective: 'contact' },
    { key: 'need',      title: 'בירור צורך',   objective: 'contact' },
    { key: 'call',      title: 'תיאום שיחה',   objective: 'meeting' },
    { key: 'present',   title: 'הצגת פתרון',   objective: 'proposal' },
    { key: 'proposal',  title: 'הצעת מחיר',    objective: 'proposal' },
    { key: 'approve',   title: 'אישור',        objective: 'close' },
    { key: 'implement', title: 'יישום',        objective: 'close' },
    { key: 'monitor',   title: 'מעקב',         objective: 'close' },
    { key: 'close',     title: 'סגירה',        objective: 'close' },
  ],
  appointment: [
    { key: 'open',     title: 'פתיחת בקשה',      objective: 'schedule' },
    { key: 'svc',      title: 'בחירת סוג שירות', objective: 'schedule' },
    { key: 'provider', title: 'בחירת נותן שירות',objective: 'schedule' },
    { key: 'offer',    title: 'הצעת זמנים',      objective: 'schedule' },
    { key: 'confirm',  title: 'אישור לקוח',      objective: 'schedule' },
    { key: 'reminder', title: 'תזכורת',          objective: 'schedule' },
    { key: 'arrive',   title: 'הגעה / ביצוע',    objective: 'resolve' },
    { key: 'summary',  title: 'סיכום טיפול',     objective: 'close' },
    { key: 'next',     title: 'המשך טיפול',      objective: 'close' },
    { key: 'close',    title: 'סגירה',           objective: 'close' },
  ],
  followup: [
    { key: 'create',  title: 'יצירת פולו-אפ',      objective: 'contact' },
    { key: 'time',    title: 'קביעת זמן',          objective: 'contact' },
    { key: 'remind',  title: 'תזכורת לנציג',       objective: 'contact' },
    { key: 'call',    title: 'ביצוע שיחה',         objective: 'contact' },
    { key: 'outcome', title: 'תוצאה',              objective: 'close' },
    { key: 'nextact', title: 'קביעת פעולה נוספת',  objective: 'close' },
    { key: 'close',   title: 'סגירת הפולו-אפ',     objective: 'close' },
  ],
  billing: [
    { key: 'open',    title: 'פתיחת גבייה',   objective: 'collect' },
    { key: 'notify',  title: 'פנייה ללקוח',   objective: 'collect' },
    { key: 'arrange', title: 'הסדר תשלום',    objective: 'collect' },
    { key: 'collect', title: 'גביית תשלום',   objective: 'collect' },
    { key: 'close',   title: 'סגירה',         objective: 'close' },
  ],
  renewal: [
    { key: 'open',     title: 'פתיחת חידוש',  objective: 'renew' },
    { key: 'review',   title: 'סקירת חוזה',   objective: 'renew' },
    { key: 'offer',    title: 'הצעת חידוש',   objective: 'proposal' },
    { key: 'approve',  title: 'אישור לקוח',   objective: 'close' },
    { key: 'close',    title: 'סגירה',        objective: 'close' },
  ],
};
/* מסלולים שמשתמשים ב-workflow קיים */
const WORKFLOW_ALIAS = {
  general: 'support', complaint: 'support', retention: 'followup',
  installation: 'appointment', training: 'appointment', cancellation: 'support',
};
function workflowFor(journey) {
  return WORKFLOWS[journey] || WORKFLOWS[WORKFLOW_ALIAS[journey]] || WORKFLOWS.sales;
}

/* ============================================================
   3.4 סוגי "הפעולה הבאה"
   ============================================================ */
const NEXT_ACTIONS = {
  followup:   { label: 'פולו-אפ',        icon: 'phone',    color: 'orange' },
  remind:     { label: 'תזכורת לפגישה',  icon: 'clock',    color: 'blue'   },
  meeting:    { label: 'פגישה',          icon: 'calendar', color: 'green'  },
  appt:       { label: 'תור שירות',      icon: 'calendar', color: 'green'  },
  callback:   { label: 'חזרה ללקוח',     icon: 'phone',    color: 'amber'  },
  proposal:   { label: 'הצעת מחיר',      icon: 'docs',     color: 'blue'   },
  mgr_task:   { label: 'משימת מנהל',     icon: 'flag',     color: 'red'    },
  cust_ok:    { label: 'אישור לקוח',     icon: 'check',    color: 'amber'  },
  wait_doc:   { label: 'המתנה למסמך',    icon: 'pause',    color: 'gray'   },
  summary:    { label: 'סיכום פגישה',    icon: 'note',     color: 'orange' },
  billing:    { label: 'גבייה',          icon: 'docs',     color: 'red'    },
  none:       { label: 'ללא פעולה',      icon: '',         color: 'gray'   },
};

/* ============================================================
   3.2 כרטיסי סיכום (לחיצים → סינון)
   ============================================================ */
const SUMMARY_CARDS = [
  { key: 'today_meetings', label: 'פגישות היום',        color: 'brand',  delta: 'לחץ לסינון', icon: 'calendar' },
  { key: 'today_followup', label: 'פולו-אפ היום',       color: 'orange', delta: 'לחץ לסינון', icon: 'phone' },
  { key: 'overdue',        label: 'באיחור',             color: 'red',    delta: 'דורש טיפול מיידי', icon: 'clock' },
  { key: 'week_meetings',  label: 'השבוע',              color: 'blue',   delta: 'לחץ לסינון', icon: 'calendar' },
  { key: 'done',           label: 'הושלמו',             color: 'green',  delta: 'לחץ לסינון', icon: 'check' },
  { key: 'new_leads',      label: 'לידים שטרם טופלו',   color: 'blue',   delta: 'ממתינים ל-SLA', icon: 'leads' },
  { key: 'open_service',   label: 'פניות שירות פתוחות', color: 'amber',  delta: 'לחץ לסינון', icon: 'tasks' },
  { key: 'pending_appt',   label: 'תורים לאישור',       color: 'amber',  delta: 'דורשים אישור', icon: 'clock' },
  { key: 'no_next',        label: 'ללא פעולה הבאה',     color: 'red',    delta: 'חריגה', icon: 'alert' },
];

/* ============================================================
   רשומות לדוגמה (עם הפרדת entity/journey/objective, SLA, עדיפות)
   ============================================================ */
const RECORDS = [
  {
    id: 1, name: 'ישראל כהן', org: 'CalBig', avatar: 'IK', phone: '052-1234567',
    entity: 'lead', journey: 'sales', objective: 'meeting', stageKey: 'meeting',
    subject: 'מכירה ראשונית', assignee: 'יואב כהן', source: 'קמפיין גוגל',
    priority: 'high', sla: { label: 'בזמן', color: 'green', mins: 55 },
    status: { label: 'נקבעה פגישה', color: 'green' },
    next: { type: 'meeting', at: 'היום 09:30' }, time: '09:30',
    meeting: { date: '22/05/24', time: '09:30', dur: 60, channel: 'Google Meet', with: 'יואב כהן' },
  },
  {
    id: 2, name: 'דנה לוי', org: 'Tech Solutions', avatar: 'DL', female: true, phone: '053-7654321',
    entity: 'prospect', journey: 'sales', objective: 'proposal', stageKey: 'reminder',
    subject: 'הצעת מערכת', assignee: 'יואב כהן', source: 'אתר',
    priority: 'medium', sla: { label: 'בזמן', color: 'green', mins: 180 },
    status: { label: 'תזכורת לפגישה', color: 'blue' },
    next: { type: 'remind', at: 'מחר 09:30' }, time: '10:30',
    meeting: { date: '23/05/24', time: '10:30', dur: 45, channel: 'טלפון', with: 'יואב כהן' },
  },
  {
    id: 3, name: 'אבי רוזן', org: 'Zohar Group', avatar: 'AR', phone: '054-1112222',
    entity: 'customer', journey: 'upsell', objective: 'proposal', stageKey: 'proposal',
    subject: 'הרחבת מנויים', assignee: 'יואב כהן', source: 'לקוח קיים',
    priority: 'medium', sla: { label: 'בזמן', color: 'green', mins: 240 },
    status: { label: 'הצעה נשלחה', color: 'amber' },
    next: { type: 'followup', at: 'היום 10:50' }, time: '12:00',
  },
  {
    id: 4, name: 'מיכל רוזן', org: 'MR Marketing', avatar: 'MR', female: true, phone: '050-3334444',
    entity: 'customer', journey: 'support', objective: 'resolve', stageKey: 'schedule',
    subject: 'תקלת התחברות', assignee: 'יואב כהן', source: 'טלפון',
    priority: 'high', sla: { label: 'קרוב לחריגה', color: 'orange', mins: 20 },
    status: { label: 'בטיפול', color: 'blue' },
    next: { type: 'appt', at: 'היום 14:00' }, time: '14:00',
  },
  {
    id: 5, name: 'שרון אביב', org: '', avatar: 'SA', phone: '052-5556666',
    entity: 'lead', journey: 'followup', objective: 'contact', stageKey: 'call',
    subject: 'מעקב לאחר שיחה', assignee: 'יואב כהן', source: 'פייסבוק',
    priority: 'medium', sla: { label: 'בזמן', color: 'green', mins: 90 },
    status: { label: 'פולו-אפ', color: 'orange' },
    next: { type: 'followup', at: 'היום 16:00' }, time: '16:00',
  },
  {
    id: 6, name: 'יואב בן דוד', org: 'BD Finance', avatar: 'YB', phone: '053-7778888',
    entity: 'lead', journey: 'sales', objective: 'contact', stageKey: 'contact',
    subject: 'שיחת הכרות', assignee: 'יואב כהן', source: 'קמפיין גוגל',
    priority: 'high', sla: { label: 'חריגה!', color: 'red', mins: -12 },
    status: { label: 'ניסיון קשר', color: 'blue' },
    next: { type: 'callback', at: 'באיחור · 12 דק\'' }, time: '17:30', overdue: true,
  },
  {
    id: 7, name: 'רונית שגב', org: 'Segev Ltd', avatar: 'RS', female: true, phone: '058-2223344',
    entity: 'customer', journey: 'billing', objective: 'collect', stageKey: 'notify',
    subject: 'תשלום שלא נגבה', assignee: 'יואב כהן', source: 'מערכת סליקה',
    priority: 'high', sla: { label: 'קרוב לחריגה', color: 'orange', mins: 30 },
    status: { label: 'ממתינה ללקוח', color: 'amber' },
    next: { type: 'billing', at: 'היום 15:00' }, time: '15:00',
  },
  {
    id: 8, name: 'עופר מלכה', org: 'OM Studio', avatar: 'OM', phone: '050-9998877',
    entity: 'former', journey: 'retention', objective: 'winback', stageKey: 'create',
    subject: 'החזרת לקוח', assignee: 'יואב כהן', source: 'ניתוח נטישה',
    priority: 'low', sla: { label: 'ללא', color: 'gray', mins: null },
    status: { label: 'לקוח לשעבר', color: 'gray' },
    next: { type: 'followup', at: 'מחר 11:00' }, time: '—',
    former: { endedAt: '01/02/24', reason: 'מעבר למתחרה', allowContact: true },
  },
  {
    id: 9, name: 'יעל שרון', org: 'YS Design', avatar: 'YS', female: true, phone: '052-8887766',
    entity: 'customer', journey: 'sales', objective: 'close', stageKey: 'close',
    subject: 'עסקה נסגרה', assignee: 'מיכל רוזן', source: 'המלצה',
    priority: 'low', sla: { label: 'הושלם', color: 'green', mins: null }, done: true,
    status: { label: 'זכייה', color: 'green' },
    next: { type: 'none', at: '—' }, time: '08:30',
  },
  {
    id: 10, name: 'משה כץ', org: 'Katz Ltd', avatar: 'MK', phone: '053-4445566',
    entity: 'customer', journey: 'support', objective: 'close', stageKey: 'close',
    subject: 'תקלה נפתרה', assignee: 'שרון אביב', source: 'טלפון',
    priority: 'low', sla: { label: 'הושלם', color: 'green', mins: null }, done: true,
    status: { label: 'נסגרה', color: 'green' },
    next: { type: 'none', at: '—' }, time: '09:15',
  },
  {
    id: 11, name: 'נועה ברק', org: 'Barak Co', avatar: 'NB', female: true, phone: '054-9990011',
    entity: 'customer', journey: 'appointment', objective: 'schedule', stageKey: 'confirm',
    subject: 'תור התקנה', assignee: 'רותם לוי', source: 'לקוח קיים',
    priority: 'medium', sla: { label: 'ממתין לאישור', color: 'amber', mins: 120 }, pendingApproval: true,
    status: { label: 'ממתינה לאישור', color: 'amber' },
    next: { type: 'appt', at: 'היום 13:00' }, time: '13:00',
  },
  {
    id: 12, name: 'איתי לוין', org: '', avatar: 'IL', phone: '050-2223311',
    entity: 'lead', journey: 'followup', objective: 'contact', stageKey: 'call',
    subject: 'מעקב הצעה', assignee: 'יואב כהן', source: 'קמפיין גוגל',
    priority: 'medium', sla: { label: 'בזמן', color: 'green', mins: 120 },
    status: { label: 'פולו-אפ', color: 'orange' },
    next: { type: 'followup', at: 'היום 11:30' }, time: '11:30',
  },
  {
    id: 13, name: 'דנה פרץ', org: 'DP Media', avatar: 'DP', female: true, phone: '058-7778899',
    entity: 'lead', journey: 'sales', objective: 'contact', stageKey: 'intake',
    subject: 'ליד חדש שטרם טופל', assignee: '—', source: 'אתר',
    priority: 'high', sla: { label: 'ממתין ל-SLA', color: 'amber', mins: 40 },
    status: { label: 'חדש', color: 'blue' },
    next: { type: 'callback', at: 'ממתין לשיוך' }, time: '—',
  },
  {
    id: 14, name: 'עומר דגן', org: 'Dagan Tech', avatar: 'OD', phone: '053-1239876',
    entity: 'customer', journey: 'support', objective: 'resolve', stageKey: 'diagnose',
    subject: 'בעיית חיוב', assignee: 'שרון אביב', source: 'וואטסאפ',
    priority: 'medium', sla: { label: 'בזמן', color: 'green', mins: 200 },
    status: { label: 'בטיפול', color: 'blue' },
    next: { type: 'callback', at: 'היום 15:30' }, time: '15:30',
  },
  {
    id: 15, name: 'ליאת כהן', org: 'LC Group', avatar: 'LC', female: true, phone: '052-3216549',
    entity: 'prospect', journey: 'sales', objective: 'meeting', stageKey: 'meeting',
    subject: 'פגישת מכירה', assignee: 'מיכל רוזן', source: 'לינקדאין',
    priority: 'medium', sla: { label: 'בזמן', color: 'green', mins: 150 },
    status: { label: 'נקבעה פגישה', color: 'green' },
    next: { type: 'meeting', at: 'היום 12:30' }, time: '12:30',
    meeting: { date: '22/05/24', time: '12:30', dur: 45, channel: 'טלפון', with: 'מיכל רוזן' },
  },
];

/* ============================================================
   13. חלונות פולו-אפ + הגדרות תזמון פולו-אפ
   ============================================================ */
const FOLLOWUP_WINDOWS = [
  { id: 'w1', range: '09:00 - 10:00', capacity: 6, booked: 5 },
  { id: 'w2', range: '11:30 - 12:30', capacity: 6, booked: 2 },
  { id: 'w3', range: '14:00 - 15:00', capacity: 6, booked: 6 },
  { id: 'w4', range: '16:00 - 17:00', capacity: 6, booked: 3 },
];
const FOLLOWUP_QUICK = ['בעוד 15 דק\'', 'בעוד 30 דק\'', 'בעוד שעה', 'מאוחר יותר היום', 'מחר בבוקר', 'מחר בצהריים'];

/* --- עזרי זמן: אין קביעה בהיסטוריה — הכל מעכשיו והלאה --- */
function nowHM() { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
function hmToMin(hhmm) { const [a, b] = String(hhmm).split(':').map(Number); return a * 60 + (b || 0); }
function minToHM(m) { m = Math.max(0, m); return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; }
function rangeStartMin(range) { return hmToMin(String(range).split('-')[0].trim()); }   // "09:00 - 10:00"
function isPastToday(hhmmOrRange) { return rangeStartMin(hhmmOrRange) <= nowHM(); }

/* שלבים אופציונליים — נוספים לפי צורך לכל ליד (דינמיות) */
const EXTRA_STAGE_LIB = [
  { key: 'deposit',  title: 'גביית מקדמה',   objective: 'collect', desc: 'תשלום מקדים לפני פגישה/טיפול',
    anchors: [{ type: 'before', key: 'meeting' }, { type: 'before', key: 'proposal' }, { type: 'after', key: 'contact' }] },
  { key: 'contract', title: 'הסכם לחתימה',   objective: 'close',   desc: 'שליחת הסכם ישירות אחרי שיחה/הצעה',
    anchors: [{ type: 'after', key: 'proposal' }, { type: 'after', key: 'contact' }] },
];
/* המסלול הדינמי של רשומה: בסיס פחות מדולגים + אופציונליים במקום הנכון */
function dynamicFlow(r) {
  const skip = r.skipStages || [];
  let flow = workflowFor(r.journey).filter(s => !skip.includes(s.key));
  (r.extraStages || []).forEach(exKey => {
    const ex = EXTRA_STAGE_LIB.find(e => e.key === exKey); if (!ex) return;
    let pos = -1;
    for (const a of ex.anchors) {
      const i = flow.findIndex(s => s.key === a.key);
      if (i >= 0) { pos = a.type === 'before' ? i : i + 1; break; }
    }
    if (pos < 0) pos = Math.max(1, flow.length - 1);   // ברירת מחדל: לפני סגירה
    flow.splice(pos, 0, { key: ex.key, title: ex.title, objective: ex.objective });
  });
  return flow;
}

/* תבניות וואטסאפ — עריכות במסך ההגדרות */
let WA_TEMPLATES = {
  arrival: 'היי {שם} 👋 מזכירים: {נושא} ב-{מועד}. נשמח שתאשר/י הגעה 🙏 — צוות CallBiz',
};
function fillTemplate(tpl, r) {
  const first = (r.name || '').split(' ')[0];
  return tpl
    .replace(/\{שם\}/g, first)
    .replace(/\{נושא\}/g, r.subject || 'התור')
    .replace(/\{מועד\}/g, r.next?.at || (r.meeting ? `${r.meeting.date} ${r.meeting.time}` : 'המועד שנקבע'));
}

/* דיוק תזמון ביומן — קפיצות בדקות; התצוגה נשארת בטווחי שעה */
let CAL_STEP = { minutes: 15 };
const CAL_STEP_OPTIONS = [5, 10, 15, 30, 60];

/* מדיניות זמן פולו-אפ (מועד חזרה) — מוגדרת בהגדרות, מסתנכרנת עם חלונות פנויים */
let FOLLOWUP_POLICY = { mode: 'same_day' };
const FU_POLICY_OPTIONS = [
  { key: 'same_day',   label: 'אותו היום — החלון הפנוי הבא' },
  { key: 'next_day',   label: 'יום אחרי — החלון הראשון בבוקר' },
  { key: 'other_hour', label: 'שעה אחרת — בעוד שעתיים' },
  { key: 'end_day',    label: 'סוף היום — 17:00' },
];

/* ============================================================
   12. מנוע תזמון – זמנים מוצעים (עם צמצום פערים ודירוג)
   ============================================================ */
const SUGGESTED_SLOTS = [
  { time: '09:30 - 10:00', owner: 'יואב כהן', score: 98, fillsGap: true,  reason: 'סוגר פער בין 09:00 ל-10:00', needsApproval: false },
  { time: '10:10 - 10:40', owner: 'יואב כהן', score: 91, fillsGap: true,  reason: 'רציף לפגישה הקודמת', needsApproval: false },
  { time: '11:20 - 11:50', owner: 'יואב כהן', score: 84, fillsGap: false, reason: 'קרוב לזמן המבוקש', needsApproval: false },
  { time: '13:20 - 13:50', owner: 'רותם לוי', score: 72, fillsGap: false, reason: 'נציג חלופי פנוי', needsApproval: false },
  { time: '17:30 - 18:00', owner: 'יואב כהן', score: 55, fillsGap: false, reason: 'שעה אחרונה ביום', needsApproval: true },
];

/* ============================================================
   18. Work Queue – הפעולה הבאה המומלצת
   ============================================================ */
const WORK_QUEUE = [
  { id: 6, kind: 'ליד באיחור (SLA)', name: 'יואב בן דוד', time: 'עכשיו', priority: 'high', why: 'חריגת SLA · 12 דק\' באיחור' },
  { id: 1, kind: 'פגישה עומדת להתחיל', name: 'ישראל כהן', time: '09:30', priority: 'high', why: 'פגישה בעוד 15 דק\'' },
  { id: 4, kind: 'לקוח ממתין למענה', name: 'מיכל רוזן', time: '14:00', priority: 'high', why: 'SLA קרוב לחריגה' },
  { id: 7, kind: 'גבייה שדורשת מעקב', name: 'רונית שגב', time: '15:00', priority: 'medium', why: 'תשלום שלא נגבה' },
  { id: 5, kind: 'פולו-אפ שהגיע זמנו', name: 'שרון אביב', time: '16:00', priority: 'medium', why: 'הגיע מועד השיחה' },
];

/* ============================================================
   10.2 סוגי תיאום + 7.2 טאבים ב-Drawer
   ============================================================ */
const APPT_TYPES = ['שיחת פולו-אפ', 'פגישה', 'תור שירות', 'שיחה עם מנהל', 'הדרכה', 'התקנה', 'טיפול טכני', 'ביקור', 'פגישה קבוצתית', 'שיחת סטטוס'];
const DRAWER_TABS = [
  { key: 'flow',     label: 'ציר טיפול', icon: 'tasks' },
  { key: 'history',  label: 'היסטוריה',  icon: 'history' },
  { key: 'log',      label: 'תיעוד',     icon: 'note' },
  { key: 'tasks',    label: 'משימות',    icon: 'check' },
  { key: 'docs',     label: 'מסמכים',    icon: 'docs' },
];

/* 9. Activity Timeline לדוגמה */
const HISTORY_SAMPLE = [
  { type: 'פתיחת ליד',      by: 'מערכת',    at: '21/05/24 21:15', desc: 'ליד נקלט ממקור: קמפיין גוגל' },
  { type: 'שיוך נציג',      by: 'מערכת',    at: '21/05/24 21:15', desc: 'הוקצה ל: יואב כהן (סבב שוויוני)' },
  { type: 'שיחה',          by: 'יואב כהן', at: '22/05/24 08:40', desc: '3 דק\' · נוצר קשר, מעוניין בפגישה' },
  { type: 'קביעת פגישה',   by: 'יואב כהן', at: '22/05/24 08:45', desc: 'פגישה נקבעה ל-22/05 09:30 · Google Meet' },
  { type: 'תזכורת נשלחה',  by: 'מערכת',    at: '22/05/24 08:46', desc: 'SMS אישור נשלח ללקוח' },
];

/* ---------- טאבים בכותרת (תהליכים) ---------- */
/* טאבים עליונים — צ'יפ זז (segmented). יומן/הגדרות/אוטומציות עברו לסיידבר */
const PROC_TABS = [
  { key: 'unified', label: 'מסך אחד לכל העבודה',   icon: 'tasks', active: true },
  { key: 'dynamic', label: 'טיפול מהלך דינמי',      icon: 'bolt' },
  { key: 'smart',   label: 'תזמון חכם והצעת זמנים', icon: 'clock' },
];

/* ============================================================
   15. הגדרות יומן – שעות פעילות, קיבולת, חריגים, אישור, סנכרון
   ============================================================ */
const WEEK_DAYS = [
  { key: 'sun', label: 'ראשון',  on: true,  start: '08:00', end: '17:00', brk: '13:00-13:30' },
  { key: 'mon', label: 'שני',    on: true,  start: '08:00', end: '17:00', brk: '13:00-13:30' },
  { key: 'tue', label: 'שלישי',  on: true,  start: '08:00', end: '18:00', brk: '13:00-14:00' },
  { key: 'wed', label: 'רביעי',  on: true,  start: '08:00', end: '17:00', brk: '—' },
  { key: 'thu', label: 'חמישי',  on: true,  start: '08:00', end: '16:00', brk: '—' },
  { key: 'fri', label: 'שישי',   on: false, start: '08:00', end: '13:00', brk: '—' },
  { key: 'sat', label: 'שבת',    on: false, start: '—',     end: '—',     brk: '—' },
];
const CAPACITY = [
  { label: 'מקסימום פגישות ביום',        value: 8 },
  { label: 'מקסימום תורים ברצף',         value: 3 },
  { label: 'מקסימום פולו-אפים בחלון',    value: 6 },
  { label: 'מקסימום פגישות בשעה',        value: 2 },
  { label: 'מקסימום תורים ממתינים',      value: 10 },
];
const DURATIONS = [
  { type: 'פגישה',       def: 60, min: 30, max: 120, prep: 10, wrap: 10 },
  { type: 'תור שירות',   def: 45, min: 30, max: 90,  prep: 15, wrap: 15 },
  { type: 'שיחת פולו-אפ',def: 10, min: 5,  max: 20,  prep: 0,  wrap: 5 },
  { type: 'הדרכה',       def: 90, min: 60, max: 120, prep: 10, wrap: 10 },
];
const EXCEPTIONS = [
  { date: '05/06/24', label: 'ערב חג שבועות', type: 'יום מקוצר' },
  { date: '11/06/24', label: 'חופשה שנתית',   type: 'סגור' },
  { date: '18/07/24', label: 'אירוע חברה',    type: 'שעות מיוחדות' },
];
const APPROVAL_POLICIES = [
  { label: 'אישור אוטומטי',            on: true },
  { label: 'אישור נציג',               on: false },
  { label: 'אישור מנהל (בחריגה בלבד)', on: true },
  { label: 'אישור לקוח',               on: true },
];
const SYNC_CALENDARS = [
  { name: 'Google Calendar',   mode: 'דו-כיווני', on: true },
  { name: 'Outlook / M365',    mode: 'חד-כיווני', on: false },
  { name: 'יומן צוות פנימי',   mode: 'דו-כיווני', on: true },
];

/* ============================================================
   16. אוטומציות
   ============================================================ */
const AUTOMATIONS = [
  { key: 'a1', trigger: 'בעת יצירת ליד',    title: 'פולו-אפ אוטומטי + חישוב SLA', desc: 'זיהוי כפילות, שיוך נציג, פתיחת פולו-אפ מיידי', on: true },
  { key: 'a2', trigger: 'בעת קביעת פגישה',  title: 'תזכורות ואישור אוטומטי', desc: 'סגירת פולו-אפ קודם, יצירת אירוע, שליחת אישור', on: true },
  { key: 'a3', trigger: 'לפני פגישה',        title: 'תזכורת ללקוח (SMS + WhatsApp)', desc: 'שעה לפני הפגישה', on: true },
  { key: 'a4', trigger: 'בעת ביטול',         title: 'הצעת זמן חלופי אוטומטית', desc: 'ביטול אירוע, פתיחת פולו-אפ, הצעת חלופה', on: true },
  { key: 'a5', trigger: 'בעת אי-הגעה',       title: 'קביעת שיחת חזרה', desc: 'סימון לא-הגיע + יצירת פולו-אפ', on: false },
  { key: 'a6', trigger: 'לאחר פגישה',        title: 'דרישת תוצאה + המלצת AI', desc: 'לא ניתן לסיים ללא פעולה הבאה', on: true },
  { key: 'a7', trigger: 'מחוץ לשעות פעילות', title: 'העברה לחלון הפנוי הבא', desc: 'פולו-אפ שנכנס בלילה יתוזמן לבוקר', on: true },
];

/* ---------- 9. תרשים זרימת ליד אוטומטי ---------- */
const LEAD_FLOW = [
  { t: 'ליד נכנס',        s: '21/05 21:15', c: 'blue' },
  { t: 'זיהוי כפילות',    s: 'לא נמצאה התאמה', c: 'gray' },
  { t: 'שיוך נציג',       s: 'סבב שוויוני', c: 'gray' },
  { t: 'מחוץ לשעות?',     s: 'כן · 21:15', c: 'amber', branch: true },
  { t: 'העברה לבוקר',     s: '22/05 08:00', c: 'green' },
  { t: 'פולו-אפ מיידי',   s: 'התראה לנציג + SLA', c: 'brand' },
];

/* ---------- מקרא סטטוסים + סוגי תיאום ---------- */
const STATUS_LEGEND = [
  { label: 'קבע מחדש', color: '#5B4CE6' },
  { label: 'הושלם',    color: '#16A34A' },
  { label: 'באיחור',   color: '#DC2626' },
  { label: 'בהמתנה',   color: '#EA6A2C' },
  { label: 'טרם הוקצה',color: '#9A9EB1' },
];
const APPT_TYPE_LEGEND = [
  { label: 'שיחת פולו-אפ', icon: 'phone' },
  { label: 'פגישה',        icon: 'calendar' },
  { label: 'תור שירות',    icon: 'tasks' },
  { label: 'שיחה עם גורם', icon: 'user' },
];

/* ---------- 25. כללי ניתוב / עדיפות ---------- */
const ROUTING_RULES = ['פעילות', 'מקור ליד', 'אזור', 'סוג שירות', 'שפה', 'מיומנות', 'עומס', 'סבב שוויוני', 'מי שטיפל בעבר'];
const PRIORITY_RULES = ['גיל הליד', 'מקור', 'ערך פוטנציאלי', 'SLA', 'מספר ניסיונות', 'לקוח VIP', 'דחיפות', 'זמן המתנה'];

/* ---------- יומן רב-עובדים (9 / מסך 4) ---------- */
const CAL_OWNERS = ['יואב כהן', 'מיכל רוזן', 'אבי זוהר'];
const CAL_EVENTS = {
  'יואב כהן': [
    { h: 8,  dur: 1,   t: 'שיחת סטטוס', c: 'brand' },
    { h: 9.5,dur: .5,  t: 'ישראל כהן – פגישה', c: 'green', recId: 1 },
    { h: 9.5,dur: .5,  t: 'שיחת ספק', c: 'blue' },       // חפיפה בשעה 9
    { h: 11, dur: 1,   t: 'ישיבת צוות', c: 'blue' },
    { h: 13, dur: 1,   t: 'הפסקת צהריים', c: 'gray' },
    { h: 16, dur: 1,   t: 'פולו אפ – שרון אביב', c: 'orange', recId: 5 },
  ],
  'מיכל רוזן': [
    { h: 9,  dur: 1.5, t: 'הדרכה', c: 'blue' },
    { h: 11, dur: 1,   t: 'שיחה עם ספק', c: 'green' },
    { h: 14, dur: .5,  t: 'מיכל רוזן – תור', c: 'orange', recId: 4 },
    { h: 14, dur: .5,  t: 'ליאת כהן – פגישה', c: 'green', recId: 15 },  // חפיפה בשעה 14
  ],
  'אבי זוהר': [
    { h: 10, dur: 1,   t: 'אבי רוזן – ייעוץ', c: 'green', recId: 3 },
    { h: 13.5,dur: 1,  t: 'סיור', c: 'brand' },
    { h: 15, dur: 1,   t: 'רונית שגב – גבייה', c: 'orange', recId: 7 },
  ],
};

/* ---------- ציר תקשורת / תיעוד (9) ---------- */
const COMM_TYPES = {
  call:     { label: 'שיחה',            icon: 'phone',    color: 'green'  },
  wa:       { label: 'WhatsApp',        icon: 'whatsapp', color: 'green'  },
  mail:     { label: 'מייל',            icon: 'mail',     color: 'blue'   },
  noanswer: { label: 'אין מענה',        icon: 'phone',    color: 'red'    },
  callback: { label: 'ביקש לחזור מאוחר',icon: 'clock',    color: 'amber'  },
  note:     { label: 'הערה',            icon: 'note',     color: 'gray'   },
};
const COMM_LOG = [
  { type: 'wa',       at: '22/05 08:46', by: 'מערכת',    text: 'נשלח אישור פגישה ב-WhatsApp' },
  { type: 'call',     at: '22/05 08:40', by: 'יואב כהן', text: 'שיחה · 3 דק׳ · הלקוח מעוניין, ביקש פגישה' },
  { type: 'callback', at: '21/05 17:22', by: 'יואב כהן', text: 'הלקוח ביקש שנחזור אליו מחר בבוקר' },
  { type: 'noanswer', at: '21/05 17:20', by: 'יואב כהן', text: 'ניסיון חיוג — אין מענה' },
  { type: 'mail',     at: '21/05 15:00', by: 'יואב כהן', text: 'נשלח חומר שיווקי במייל' },
  { type: 'note',     at: '21/05 14:30', by: 'מיכל רוזן', text: 'ליד איכותי מקמפיין גוגל' },
];
const COMM_ADD_TYPES = ['call', 'wa', 'mail', 'noanswer', 'callback', 'note'];

/* ---------- אנשי קשר לליד/לקוח (ריבוי אנשי קשר + תפקידים) ---------- */
/* תפקידים — מקסימום 6 נפוצים + "אחר"; תפקיד מותאם נכנס לרשימה לפעמים הבאות */
let CONTACT_ROLES = ['איש קשר ראשי', 'מנכ"ל', 'בעלים', 'הנהלת חשבונות', 'אחר'];
const CUSTOM_ROLES = [];
function addCustomRole(role) {
  role = (role || '').trim();
  if (!role || CONTACT_ROLES.includes(role)) return;
  CONTACT_ROLES.splice(CONTACT_ROLES.length - 1, 0, role);   // לפני "אחר"
  CUSTOM_ROLES.push(role);
  while (CONTACT_ROLES.length > 7) {                          // עד 6 + "אחר"
    const oldest = CUSTOM_ROLES.shift();
    const i = CONTACT_ROLES.indexOf(oldest);
    if (i >= 0) CONTACT_ROLES.splice(i, 1); else break;
  }
}
function contactsFor(r) {
  if (!r.contacts) r.contacts = [{ name: r.name, role: 'איש קשר ראשי', phone: r.phone || '', mail: r.mail || '', primary: true }];
  return r.contacts;
}
/* סנכרון איש הקשר הראשי לנתוני הרשומה (טלפון/מייל למעלה + לשיחה יוצאת) */
function syncPrimaryContact(r) {
  const p = contactsFor(r).find(c => c.primary) || contactsFor(r)[0];
  if (!p) return;
  r.phone = p.phone || '';
  r.mail = p.mail || '';
}

/* ציר תקשורת פר-רשומה — נגזר מהנתונים האמיתיים של הליד */
function commLogFor(r) {
  if (!r.commLog) r.commLog = buildCommLog(r);
  return r.commLog;
}
function buildCommLog(r) {
  const log = [];
  if (r.meeting) {
    log.push({ type: 'wa',   at: '22/05 08:46', by: 'מערכת',   text: `נשלח אישור פגישה ב-WhatsApp (${r.meeting.date} ${r.meeting.time})` });
    log.push({ type: 'call', at: '22/05 08:40', by: r.assignee, text: `שיחה · 3 דק׳ · ${r.name.split(' ')[0]} אישר/ה את הפגישה` });
  }
  if (r.next?.type === 'followup') log.push({ type: 'callback', at: '21/05 17:22', by: r.assignee, text: `הלקוח ביקש שנחזור אליו — נקבע פולו-אפ ${r.next.at || ''}` });
  if (r.overdue) log.push({ type: 'noanswer', at: '21/05 17:20', by: r.assignee, text: 'ניסיון חיוג — אין מענה' });
  if (r.journey === 'billing') log.push({ type: 'mail', at: '21/05 15:00', by: 'מערכת', text: 'נשלחה דרישת תשלום במייל' });
  if (r.journey === 'support') log.push({ type: 'call', at: '21/05 16:05', by: r.assignee, text: `שיחת אבחון · ${r.subject}` });
  if (r.journey === 'upsell')  log.push({ type: 'mail', at: '21/05 12:10', by: r.assignee, text: 'נשלחה הצעת הרחבה במייל' });
  log.push({ type: 'note', at: '21/05 14:30', by: 'מערכת', text: `הפנייה נקלטה · מקור: ${r.source} · מסלול ${(JOURNEY_TYPES[r.journey] || {}).label || ''}` });
  return log;
}

/* ============================================================
   26. מדדים ודוחות
   ============================================================ */
const METRICS = [
  { label: 'זמן תגובה לליד חדש',   value: '4.2', unit: 'דק\'',  trend: -18, good: 'down', icon: 'clock' },
  { label: 'זמן עד שיחה ראשונה',   value: '11',  unit: 'דק\'',  trend: -9,  good: 'down', icon: 'phone' },
  { label: 'זמן עד קביעת פגישה',   value: '1.4', unit: 'ימים', trend: -22, good: 'down', icon: 'calendar' },
  { label: 'אחוז הגעה',            value: '87',  unit: '%',    trend: 5,   good: 'up',   icon: 'check' },
  { label: 'אחוז ביטולים',         value: '6',   unit: '%',    trend: -3,  good: 'down', icon: 'close' },
  { label: 'אחוז אי-הגעה',         value: '4',   unit: '%',    trend: -2,  good: 'down', icon: 'alert' },
  { label: 'זמן ממוצע לסגירה',     value: '3.1', unit: 'ימים', trend: -11, good: 'down', icon: 'tasks' },
  { label: 'ניצול יומן',           value: '78',  unit: '%',    trend: 8,   good: 'up',   icon: 'layers' },
  { label: 'צמצום פערים',          value: '64',  unit: '%',    trend: 12,  good: 'up',   icon: 'target' },
  { label: 'עמידה ב-SLA',          value: '92',  unit: '%',    trend: 4,   good: 'up',   icon: 'flag' },
  { label: 'המרה ליד → פגישה',     value: '41',  unit: '%',    trend: 7,   good: 'up',   icon: 'leads' },
  { label: 'המרה פגישה → עסקה',    value: '33',  unit: '%',    trend: -2,  good: 'up',   icon: 'reports' },
];
const FUNNEL = [
  { label: 'לידים',    value: 120, color: 'blue'  },
  { label: 'פגישות',   value: 49,  color: 'brand' },
  { label: 'הצעות',    value: 31,  color: 'amber' },
  { label: 'עסקאות',   value: 16,  color: 'green' },
];
const REP_STATS = [
  { name: 'יואב כהן',  meetings: 34, util: 82 },
  { name: 'מיכל רוזן', meetings: 28, util: 74 },
  { name: 'אבי זוהר',  meetings: 21, util: 61 },
  { name: 'רותם לוי',  meetings: 17, util: 55 },
];
const FOLLOWUP_STATS = { total: 142, done: 118, overdue: 9, scheduled: 15 };

/* ============================================================
   ניהול עובדים – מחלקות · תפקידים · תחומי עיסוק ואחריות
   ============================================================ */
const DEPARTMENTS    = ['מכירות', 'שירות', 'גבייה', 'תפעול', 'הנהלה'];
const ROLE_PRESETS   = ['נציג', 'נציג בכיר', 'מנהל מוקד', 'מנהל', 'אדמין'];
const OCCUPATIONS    = ['שיחות נכנסות', 'שיחות יוצאות', 'פגישות', 'הדרכות', 'התקנות', 'גבייה', 'שימור', 'תמיכה טכנית'];
const RESPONSIBILITIES = ['לידים חדשים', 'לקוחות VIP', 'אזור צפון', 'אזור מרכז', 'אזור דרום', 'חידושים', 'תלונות', 'גבייה'];
const AVAIL_STATES = {
  available: { label: 'זמין ונגיש', color: '#16A34A' },
  active:    { label: 'פעיל · לא בדף', color: '#2F6BEB' },
  offline:   { label: 'לא מחובר', color: '#9A9EB1' },
};
let STAFF = [
  { id: 'yk', name: 'יואב כהן',  dept: 'הנהלה',  role: 'מנהל',     perm: 'מנהל', occ: ['פגישות', 'שיחות יוצאות'], resp: ['לידים חדשים', 'לקוחות VIP'], avail: 'available' },
  { id: 'ml', name: 'מיכל רוזן', dept: 'מכירות', role: 'נציג בכיר', perm: 'נציג', occ: ['פגישות', 'שיחות נכנסות'],  resp: ['אזור מרכז'], avail: 'available' },
  { id: 'sa', name: 'שרון אביב', dept: 'שירות',  role: 'נציג',     perm: 'נציג', occ: ['תמיכה טכנית', 'שיחות נכנסות'], resp: ['תלונות'], avail: 'active' },
  { id: 'rl', name: 'רותם לוי',  dept: 'מכירות', role: 'נציג',     perm: 'נציג', occ: ['שיחות יוצאות'], resp: ['אזור צפון'], avail: 'offline' },
  { id: 'dp', name: 'דנה פרל',   dept: 'גבייה',  role: 'נציג בכיר', perm: 'נציג', occ: ['גבייה', 'שיחות יוצאות'], resp: ['גבייה', 'חידושים'], avail: 'available' },
];

/* ============================================================
   19. הרשאות – מטריצת תפקידים
   ============================================================ */
const ROLES = ['נציג', 'מנהל מוקד', 'מנהל', 'אדמין'];
const PERMISSIONS = [
  { label: 'צפייה',                grants: [1,1,1,1] },
  { label: 'עריכה',                grants: [1,1,1,1] },
  { label: 'קביעת פגישה',          grants: [1,1,1,1] },
  { label: 'שינוי גורם מטפל',      grants: [0,1,1,1] },
  { label: 'צפייה ביומן אחר',      grants: [0,1,1,1] },
  { label: 'ביטול',               grants: [1,1,1,1] },
  { label: 'שינוי Workflow',       grants: [0,0,1,1] },
  { label: 'דריסת מגבלת זמן',      grants: [0,0,1,1] },
  { label: 'קביעה בשעה חסומה',     grants: [0,1,1,1] },
  { label: 'אישור חריגה',          grants: [0,1,1,1] },
  { label: 'צפייה בהקלטות',        grants: [0,1,1,1] },
  { label: 'מחיקת תיעוד',          grants: [0,0,0,1] },
  { label: 'ייצוא מידע',           grants: [0,1,1,1] },
];

/* ============================================================
   25.5 רשימת המתנה (Waitlist)
   ============================================================ */
const WAITLIST = [
  { name: 'גיל שמש',   req: 'היום 10:00–11:00', svc: 'פגישה',    since: '08:15', pos: 1 },
  { name: 'תמר גל',    req: 'מחר בבוקר',        svc: 'תור שירות', since: 'אתמול', pos: 2 },
  { name: 'דור אוחיון',req: 'היום אחה"צ',       svc: 'פולו-אפ',   since: '09:40', pos: 3 },
];

/* ============================================================
   שלב ד' – המלצות AI
   ============================================================ */
const AI_INSIGHTS = [
  { type: 'סיכון אי-הגעה', name: 'יואב בן דוד', level: 'high',   text: 'סבירות 72% לאי-הגעה · הליד לא ענה ל-2 ניסיונות', action: 'שלח תזכורת WhatsApp' },
  { type: 'זמן אופטימלי',  name: 'דנה לוי',     level: 'info',   text: 'ההמרה הגבוהה ביותר שלה בשעות הבוקר (09:00–11:00)', action: 'הצע 09:30' },
  { type: 'פעולה מומלצת',  name: 'אבי רוזן',    level: 'info',   text: 'לא היה מגע 4 ימים אחרי הצעת המחיר', action: 'צור פולו-אפ חם' },
  { type: 'עומס צפוי',     name: 'יום חמישי',   level: 'medium', text: 'עומס גבוה ב-14:00–16:00 · שקול פתיחת חלון נוסף', action: 'הוסף חלון' },
];

/* ---------- ניווט צד ---------- */
const NAV = [
  { key: 'home',      label: 'ראשי',      icon: 'home' },
  { key: 'leads',     label: 'לידים',     icon: 'leads' },
  { key: 'meetings',  label: 'פגישות',    icon: 'calendar', active: true },
  { key: 'calendar',  label: 'יומן',      icon: 'clock' },
  { key: 'calls',     label: 'שיחות',     icon: 'phone' },
  { key: 'whatsapp',  label: 'וואטסאפ',   icon: 'whatsapp' },
  { key: 'mail',      label: 'דוא"ל',     icon: 'mail' },
  { key: 'docs',      label: 'מסמכים',    icon: 'docs' },
  { key: 'clients',   label: 'לקוחות',    icon: 'clients' },
];
/* קבוצת "ניהול" — מתקפלת בסיידבר כדי לא לתפוס מקום */
const NAV_MANAGE = [
  { key: 'reports',    label: 'דוחות',     icon: 'reports' },
  { key: 'automation', label: 'אוטומציות', icon: 'bolt' },
  { key: 'settings',   label: 'הגדרות',    icon: 'settings' },
];
