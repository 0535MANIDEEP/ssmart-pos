# POS UI/UX Overhaul — MARG ERP Style + Crash Recovery + Backup

## Context

The POS checkout screen currently works but lacks speed, ergonomics, crash resilience, and backup. A busy kirana shop cannot afford to lose a bill mid-transaction or lose data on system failure. This plan adds: crash recovery (auto-save bills to SQLite), daily auto-backup with close confirmation, MARG-style keyboard shortcuts, bill hold/switch, audio feedback, fullscreen mode, and confirmation dialogs.

---

## The Crash Recovery Architecture

### Problem Scenarios
| Scenario | Without recovery | With recovery |
|----------|-----------------|---------------|
| Browser crash | All bills lost | Bills restored from SQLite on login |
| Power failure | All bills lost | Bills restored from SQLite on restart |
| System hang/restart | All bills lost | Bills restored from SQLite on restart |
| Tab accidentally closed | Bill lost | Bill restored from SQLite on next login |
| Network disconnect mid-bill | Checkout fails | Auto-retry, draft saved locally |
| Daily data loss | No backup exists | Auto-backup every day + manual backup |

### Solution: Two-Tier Persistence + Daily Backup

```
TIER 1: Backend SQLite (Primary — survives everything except machine death)
  ↓ Auto-save every 2s on meaningful change
  ↓ DraftBill table with full bill state as JSON
  ↓ WAL mode for crash-safe writes (better-sqlite3 default)

TIER 2: IndexedDB (Secondary — survives browser crash, offline buffer)
  ↓ idb wrapper (1.2KB) for clean async API
  ↓ navigator.storage.persist() to prevent eviction
  ↓ BroadcastChannel for cross-tab sync

TIER 3: Daily Auto-Backup (Archive — survives catastrophic failure)
  ↓ db.backup() via SQLite Online Backup API
  ↓ node-cron scheduled daily at configurable time (default 2 AM IST)
  ↓ 30-day retention, rotated automatically
  ↓ Manual backup from Settings + Close dialog
```

### Recovery Flow
```
Cashier logs in
  → App checks: any unfinished drafts for this user?
  → YES: "You have 2 unfinished bills. Restore?"
    → Bill from 3 min ago: 15 items, ₹2,450 [Restore] [Discard]
    → Bill from 8 min ago: 3 items, ₹380 [Restore] [Discard]
  → NO: Fresh POS screen
```

### Backup Flow (on close)
```
User clicks Shutdown button (⏻)
  → Dialog: "Backup before closing?"
  → [Backup & Close] → runs db.backup() → shows progress → navigates to login
  → [Close Without Backup] → navigates to login
  → [Cancel] → stays on POS
```

---

## Keyboard Shortcut Map (MARG Convention)

| Key | Action | Notes |
|-----|--------|-------|
| **F1** | Help overlay | Shows all shortcuts in a modal |
| **F2** | Hold current bill | Saves to DB, starts new one |
| **F3** | Recall held bill | Opens held bill selector |
| **F4** | Cycle payment method | Cash → UPI → Card → Cash |
| **F5** | New bill / Clear cart | Confirms if cart has items |
| **F6** | Customer lookup | Focuses phone input |
| **F7** | Discount | Opens discount field |
| **F8** | Toggle sidebar | Collapse/expand nav |
| **F9** | Return/exchange | Opens return panel |
| **F10** | Print last receipt | Reprints last completed invoice |
| **F11** | Fullscreen billing | Hides sidebar + top bar |
| **F12** | Settings (admin only) | Navigates to settings |
| **End** | Finalize bill | Shows confirmation dialog, always |
| **Escape** | Cancel / close dialog | Back out of modals, clear focus |
| **Ctrl+Space** | Focus barcode input | Jump to scanner/search field |
| **PgUp / PgDn** | Switch between held bills | Cycle through tab list |

---

## Implementation Phases

### Phase 1: Backend — DraftBill Schema + API
**Prisma schema addition:**
```prisma
model DraftBill {
  id          Int      @id @default(autoincrement())
  userId      Int
  user        User     @relation(fields: [userId], references: [id])
  label       String?
  state       String   // JSON blob of full Bill interface
  isHeld      Boolean  @default(false)
  version     Int      @default(1)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([userId])
}
```

**New API routes:** `backend/src/routes/bills.js`
- `GET /api/bills/draft` — all drafts for current user
- `POST /api/bills/draft` — upsert a draft (create or update by bill UUID)
- `DELETE /api/bills/draft/:id` — delete draft
- `POST /api/bills/draft/:id/hold` — mark as held
- `POST /api/bills/draft/:id/recall` — unmark held

**Auto-cleanup:** Delete drafts older than 24 hours on startup.

### Phase 2: Backend — Backup System
**Install:** `npm install node-cron` in backend

**New file:** `backend/src/lib/backup.js`

```js
// better-sqlite3 backup API (verified working)
async function performBackup(db, backupDir) {
  fs.mkdirSync(backupDir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const dest = path.join(backupDir, `pos-backup-${date}.db`);

  try {
    await db.backup(dest);  // Async, non-blocking

    // Verify integrity
    const verify = new Database(dest, { readonly: true });
    const ok = verify.pragma('integrity_check', { simple: true });
    verify.close();

    if (ok !== 'ok') {
      fs.unlinkSync(dest);
      throw new Error('Backup integrity check failed');
    }
    return dest;
  } catch (err) {
    try { fs.unlinkSync(dest); } catch {} // Clean up partial file
    throw err;
  }
}
```

**Scheduled backup:** node-cron v4 with IST timezone
```js
const cron = require('node-cron');

const task = cron.schedule('0 0 2 * * *', async () => {
  await performBackup(db, backupDir);
}, {
  name: 'daily-backup',
  timezone: 'Asia/Kolkata',
  noOverlap: true,
  missedExecutionTolerance: 2 * 60 * 60 * 1000, // 2 hours
});

task.on('execution:failed', (ctx) => {
  console.error('Backup failed:', ctx.execution?.error);
});
```

**Startup catch-up:** Check if today's backup was missed (node-cron v4 removed runOnInit)
```js
const lastBackup = getLastBackupTime(); // from DB or file
const today = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
if (lastBackup?.date !== today) {
  await performBackup(db, backupDir); // Missed today, run now
}
```

**Retention:** Delete backups older than 30 days on each new backup.

**Backup API routes:** `backend/src/routes/backup.js`
- `POST /api/backup/run` — manual backup (admin only)
- `GET /api/backup/status` — last backup time, next scheduled, count
- `GET /api/backup/list` — list backups with sizes/dates
- `POST /api/backup/restore/:filename` — restore from backup (admin, with confirmation)

### Phase 3: Frontend — Draft Persistence Layer
**Install:** `npm install idb` in frontend (1.2KB, promise-based IndexedDB wrapper)

**New file:** `frontend/lib/drafts.ts`
- `saveDraft(bill)` — POST to `/api/bills/draft`
- `loadDrafts()` — GET `/api/bills/draft`
- `deleteDraft(id)` — DELETE `/api/bills/draft/:id`
- `holdDraft(id)` — POST `/api/bills/draft/:id/hold`

**Auto-save hook:** `frontend/hooks/useAutoSave.ts`
- Debounced (2 seconds after last meaningful change)
- Triggers: cart change, customer change, discount change, payment method change
- Does NOT trigger: focus changes, UI-only state
- **Does NOT save in beforeunload** (transactions abort!) — saves on meaningful actions only
- `visibilitychange` handler: flush immediately when tab goes hidden
- Falls back to IndexedDB if backend unreachable

**CRITICAL:** Do NOT save in `beforeunload` handlers — IndexedDB transactions created in unload handlers abort before executing. Instead, save on every meaningful action (debounced) so data is always recent.

**IndexedDB fallback:** `frontend/lib/drafts-local.ts`
- Uses `idb` wrapper for clean async API
- Database: `ssmart-pos-drafts`, object store: `drafts`
- `navigator.storage.persist()` to prevent eviction
- Only used when backend is unreachable

### Phase 4: Frontend — Bill Manager with Crash Recovery
**New file:** `frontend/hooks/useBillManager.ts`

**State:**
- `activeBill: Bill` — current bill being edited
- `bills: Bill[]` — held bills
- `loading: boolean` — true while checking for drafts
- `showRecoveryDialog: boolean` — true if drafts found

**On mount (POS page load):**
1. `loadDrafts()` from backend
2. Separate into: `heldBills` (isHeld=true) and `activeDraft` (most recent)
3. If drafts exist → show recovery dialog
4. If activeDraft exists → offer to restore
5. If heldBills exist → populate bill tabs

**Bill interface:**
```ts
interface Bill {
  id: string;          // crypto.randomUUID()
  label: string;
  cart: CartItem[];
  customer: Customer | null;
  customerName: string;
  customerPhone: string;
  duePaid: string;
  returnLines: ReturnDraftLine[];
  refundMode: "CASH" | "CREDIT";
  useCredit: boolean;
  discountType: "percent" | "amount" | null;
  discountValue: number;
  pointsRedeemed: number;
  paymentMethod: PaymentMethod;
  amountPaid: string;
  createdAt: number;
}
```

**Key methods:**
- `holdBill()` — saves to DB with isHeld=true, creates fresh bill
- `recallBill(id)` — loads from DB, swaps into active state
- `closeBill(id)` — deletes from DB, removes from array
- `switchToBill(id)` — quick switch
- `finalizeBill()` — completes sale, deletes draft

### Phase 5: Sound Effects Engine
**New file:** `frontend/lib/sounds.ts`

Web Audio API — single AudioContext, reuse for all sounds. Must resume on first user gesture (browser autoplay policy).

```js
class POSSounds {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.enabled = true;
  }

  init() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    this.masterGain.gain.value = 0.5;

    // Resume on first interaction (browser autoplay policy)
    const resume = () => {
      if (this.ctx.state === 'suspended') this.ctx.resume();
    };
    document.addEventListener('click', resume, { once: true });
    document.addEventListener('keydown', resume, { once: true });
  }

  _play(freq, type, duration, gainValue = 0.3) {
    if (!this.ctx || !this.enabled) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(gainValue, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + duration);
  }

  click() { this._play(1000, 'sine', 0.01, 0.1); }        // Keyboard click
  scan() { this._play(1500, 'square', 0.02, 0.2); }        // Barcode scan
  addItem() { this._play(880, 'sine', 0.1, 0.3); }         // Item added
  error() { this._play(200, 'square', 0.2, 0.3); }         // Error
  success() { /* two ascending tones */ }                    // Sale complete
  doubleBeep() { /* two short beeps */ }                     // Bill held
}
```

### Phase 6: Keyboard Shortcut System
**New file:** `frontend/hooks/usePosShortcuts.ts`

- Global `keydown` listener on `window`
- Detects F1–F12, End, Escape, Ctrl+Space, PgUp/PgDn
- Only active on `/pos` route
- Ignores when focus is in `<input>`, `<textarea>`, `<select>` (except Ctrl+Space)
- Calls bill manager + POS page callbacks
- Plays keyboard click sound

### Phase 7: Confirmation Dialogs
**New file:** `frontend/components/ui/Dialog.tsx`

- Modal with `role="dialog"`, `aria-modal="true"`
- framer-motion `AnimatePresence` for enter/exit
- Trap focus, Escape closes, Enter confirms

**Three dialog types:**

**1. End Sale Confirmation:**
- Items count + list (truncated if > 5)
- Grand total, payment method, customer name
- "Confirm Sale" and "Cancel"

**2. Crash Recovery Dialog (on login):**
- "You have unfinished bills from your last session"
- List each draft with: label, items count, total, last saved time
- "[Restore]" and "[Discard]" per draft
- "Restore All" and "Discard All"

**3. Close/Shutdown Confirmation:**
- "Backup before closing?"
- [Backup & Close] → progress bar → login
- [Close Without Backup] → login immediately
- [Cancel] → stays

### Phase 8: motion Integration
**Install:** `npm install motion` in frontend (NOT framer-motion — package renamed)

```tsx
// Import from motion/react, NOT framer-motion
import { motion, AnimatePresence } from "motion/react";
```

**Page transitions:** Use `template.tsx` (not layout.tsx) for AnimatePresence
```tsx
// frontend/app/(app)/template.tsx
"use client";
import { motion, AnimatePresence } from "motion/react";
import { usePathname } from "next/navigation";

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.15 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
```

**Animations:**
- Toast: slide in from right, fade out
- Cart items: `layout` animation on add/remove
- Bill tabs: slide transition
- Sidebar: animate width collapse
- Dialog: fade + scale backdrop
- Buttons: `whileTap={{ scale: 0.97 }}`

### Phase 9: Redesigned POS Page
**Rewrite:** `frontend/app/(app)/pos/page.tsx`

```
┌─────────────────────────────────────────────────────────────┐
│ [Bill 1] [Bill 2] [Bill 3] [+]    ● Saved   [Sidebar] [⏻] │
├───────────────────────────────┬─────────────────────────────┤
│  SEARCH / BARCODE INPUT       │  CUSTOMER          [F6]     │
│  ┌───────────────────────────┐│  Phone: [_________] 🔍     │
│  │ Scan or type...           ││  Name: [___________]       │
│  └───────────────────────────┘│                             │
│                               │  DISCOUNT          [F7]     │
│  CART                         │  [None ▾] [_________]      │
│  ┌───────────────────────────┐│                             │
│  │ Item    Qty  Price  Total ││  PAYMENT            [F4]    │
│  │ Aashir..  2  ₹265   ₹530 ││  [CASH] [UPI] [CARD]      │
│  │ Fortune.  1  ₹189   ₹189 ││                             │
│  │ Maggi....  3   ₹14    ₹42││  RETURNS            [F9]    │
│  │                           ││                             │
│  │ ─────────────────────── │  │  ─────────────────────────  │
│  │ Grand Total    ₹761.00   ││  Subtotal      ₹761.00     │
│  └───────────────────────────┘│  GST (incl.)   ₹91.32      │
│                               │  ─────────────────────────  │
│                               │  TO COLLECT     ₹761.00     │
│                               │                             │
│                               │  [ ====== END SALE ====== ] │
│                               │           [F12 / End]       │
└───────────────────────────────┴─────────────────────────────┘
```

**Key changes:**
- "END SALE" button → always shows confirmation dialog
- Shortcut hints on buttons
- Auto-save indicator (green dot = saved, yellow = saving)
- Shutdown button (⏻) → close confirmation dialog
- Bill tabs with held bill count badge
- **Quick quantity input** — click qty number → popover with presets (1,2,3,5,10,20,50) + custom input

### Phase 9A: Quick Quantity Input Component
**New file:** `frontend/components/QuantityPopover.tsx`

**Three-layer quantity input:**
1. **Clickable qty number** — click to edit, shows popover
2. **Preset buttons** — 1, 2, 3, 5, 10, 20, 50 for one-tap quantity
3. **Custom input** — type any number, press Enter

**Component spec:**
- Trigger: click on cart row quantity number
- Popover width: 200px
- Preset buttons: 40×40px each (touch-friendly)
- Custom input: number type, min=1, max=stock
- Close on: Enter, click outside, Escape
- `aria-label="Set quantity for [product name]"`
- `aria-live="polite"` on quantity display

**Integration with cart:**
- Replace plain quantity number with QuantityPopover
- Keep +/- buttons for ±1 adjustments
- Keyboard: type digits when cart row focused → set quantity directly
- Show stock warning if quantity exceeds available stock

### Phase 10: Sidebar Collapse + Fullscreen
**Edit:** `frontend/components/AppShell.tsx`

- `collapsed` state (persisted in localStorage)
- Collapsed: 64px icon-only rail
- `F8` toggles collapsed, `F11` toggles fullscreen

### Phase 11: Theme Polish
**Edit:** `frontend/app/globals.css`

- Add `--info` token: `#3b82f6`
- Add `--surface-elevated` for modals
- Animation keyframes for toast
- WCAG AA contrast (4.5:1 minimum)

**Edit:** `frontend/components/Toast.tsx`
- Theme tokens instead of hardcoded colors
- motion enter/exit animations

### Phase 12: HSN Removal from Receipts
**Edit:** `backend/src/lib/receipt.js` — remove HSN
**Edit:** `backend/src/lib/escposReceipt.js` — remove HSN
**Edit:** `backend/src/lib/pdf.js` — optional HSN (setting `showHsnOnPdf`, default false)
**Edit:** `backend/prisma/schema.prisma` — add `showHsnOnPdf`

### Phase 13: Shortcut Help Overlay
**New file:** `frontend/components/ShortcutHelp.tsx`
- F1 trigger, categorized grid, key badges

### Phase 14: Settings Page — Backup Section
**Edit:** `frontend/app/(app)/settings/page.tsx`

New "Backup" section (admin only):
- Last backup status + time
- Next scheduled time
- "Backup Now" button with progress
- Backup history (last 10)
- Schedule: editable cron (default `0 0 2 * * *`)
- Retention: days to keep (default 30)
- Backup location: configurable path
- USB backup: toggle

---

## Files Modified/Created

| File | Action | Phase |
|------|--------|-------|
| `backend/prisma/schema.prisma` | **EDIT** — DraftBill + showHsnOnPdf | 1, 12 |
| `backend/src/routes/bills.js` | **CREATE** — draft CRUD API | 1 |
| `backend/src/lib/backup.js` | **CREATE** — backup engine | 2 |
| `backend/src/routes/backup.js` | **CREATE** — backup API | 2 |
| `backend/src/server.js` | **EDIT** — register routes + startup backup | 1, 2 |
| `backend/package.json` | **EDIT** — add node-cron | 2 |
| `frontend/package.json` | **EDIT** — add motion + idb | 3, 8 |
| `frontend/lib/drafts.ts` | **CREATE** — backend draft persistence | 3 |
| `frontend/lib/drafts-local.ts` | **CREATE** — IndexedDB fallback (idb) | 3 |
| `frontend/hooks/useAutoSave.ts` | **CREATE** — debounced auto-save | 3 |
| `frontend/hooks/useBillManager.ts` | **CREATE** — bill state + crash recovery | 4 |
| `frontend/lib/sounds.ts` | **CREATE** — Web Audio sounds | 5 |
| `frontend/hooks/usePosShortcuts.ts` | **CREATE** — keyboard shortcuts | 6 |
| `frontend/components/ui/Dialog.tsx` | **CREATE** — confirmation dialogs | 7 |
| `frontend/components/ShortcutHelp.tsx` | **CREATE** — F1 help overlay | 13 |
| `frontend/components/QuantityPopover.tsx` | **CREATE** — quick quantity input | 9A |
| `frontend/app/(app)/template.tsx` | **CREATE** — page transition animations | 8 |
| `frontend/components/Toast.tsx` | **EDIT** — tokens + animations | 8, 11 |
| `frontend/app/(app)/pos/page.tsx` | **REWRITE** — new layout | 9 |
| `frontend/components/AppShell.tsx` | **EDIT** — collapse + shutdown button | 10 |
| `frontend/app/globals.css` | **EDIT** — new tokens, animations | 11 |
| `backend/src/lib/receipt.js` | **EDIT** — remove HSN | 12 |
| `backend/src/lib/escposReceipt.js` | **EDIT** — remove HSN | 12 |
| `backend/src/lib/pdf.js` | **EDIT** — optional HSN | 12 |
| `frontend/app/(app)/settings/page.tsx` | **EDIT** — backup section | 14 |

**25 files (11 new, 14 edited)**

---

## Crash Recovery + Backup Test Plan

### Crash Recovery
1. Scan 10 items → auto-saves → press End → dialog → confirm → draft deleted
2. Scan items → force-close browser → reopen → login → "Restore bill?"
3. Hold bill (F2) → force-close → reopen → held bill in tabs
4. Scan items → kill Node.js → restart → login → draft restored
5. Hold 3 bills → force-close → reopen → all 3 restored

### Backup
6. Settings → Backup Now → progress → success → file in backups/
7. Set schedule to 1 min from now → backup runs automatically
8. Create 35 backups → only 30 remain after next backup
9. Corrupt backup file → restore shows "Backup corrupted"
10. Click shutdown → "Backup & Close" → backup runs → login
11. Click shutdown → "Close Without Backup" → login immediately

---

## Verification

1. Crash recovery: scan items, kill process, restart, verify restored
2. Backup: manual backup runs, file created, integrity verified
3. Close dialog: shutdown button shows dialog, backup & close works
4. Sound: press F2/F3/End, hear appropriate sounds
5. Keyboard-only: navigate entire POS flow without mouse
6. Fullscreen: F11 hides sidebar, all actions work
7. Receipts: thermal has no HSN, PDF has no HSN (default)
8. Accessibility: tab through elements, visible focus rings
9. `npm run lint` — no errors
10. `npx tsc --noEmit` — no type errors
