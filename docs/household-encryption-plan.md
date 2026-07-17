# bynku household encryption plan

## The promise, in plain words

Your household gets a **household key**: a simple word you choose, exactly like the key to your home.

- Only someone with that key can read your money data. Not even the team that builds bynku can read it.
- You keep the key the way you keep your house key: you remember it, and you can hand a copy to the people who live with you (your partner, your family).
- When you first set it up, we also give you a **recovery code**. You save it somewhere safe, like a spare key in a drawer. You will almost never need it.
- If you forget your household key, your recovery code lets you set a new one, and we will guide you through it step by step.
- If you ever lose both the key and the recovery code, no one can open your old data, not even us. That is the whole point of it being safe. In that case we can help you start fresh with a new key, but the previous data cannot be brought back.

That is everything a user needs to understand. Nothing below this line needs to be shown to them.

---

## What is protected, and what is not

Protected (unreadable without the key): every money amount. Income, expenses, debts, project balances and targets, allocations, movements, and the computed baseline.

Not protected by default: the shape around the money. Household size, country, dates, and spending category names. These reveal patterns but not "how much." We can also encrypt notes and merchant names if you want to go further. This is a decision to confirm.

## How it works under the hood (team only)

The user only ever deals with two things: the **word** and the **recovery code**. Behind them:

- Each household has a hidden, random **data key** that actually encrypts the rows. The user never sees it.
- The word does not encrypt the data directly. It unlocks the hidden data key. The recovery code unlocks the same hidden data key by a second path. Our servers only ever store the **locked** versions of that key plus the encrypted data. They never store anything that can open it.
- The easy word is turned into a strong lock with a slow, salted key-stretching step (Argon2id with a per-household random salt). This is what makes a simple word safe: each guessing attempt costs about a second, so casual or accidental reading is impossible and even a determined attempt on one household is slow.
- The cipher is AES-256-GCM per amount field.
- The word, the recovery code, and the hidden data key exist only on the device, only while the app is open.

Why this shape: it lets the user change the word instantly without re-encrypting anything, and it lets the recovery code work, all without the servers ever holding a way in.

## Sharing inside a household (your wife keeps full access)

One key per household, shared by everyone who lives there, like copies of the same house key.

- When you invite someone, the key travels inside the invite link, in the part after the `#`. By web rules that part never reaches our servers, so we never see it. Alternatively you just tell them the word.
- The new member logs in, enters the word once on their device, and sees everything. Same as today.
- This is unchanged for existing shared households: after migration, both of you use the same word and both see everything. Nothing about the shared experience changes.

## Backend features (coach and AI capture)

Some features run on our servers and need to see the numbers to do their job. They will get the numbers from your device for that one request, not from the database.

- Before you use the coach, your device gathers the facts it already has in front of you (income, expenses, debt status, project status) and sends that bundle to the coach for that single request. The server uses it, answers, and keeps nothing.
- AI capture (voice, photo, statement) already sends content to the model on the server for the moment it reads your receipt. Same rule: used, not stored.
- Baseline and the national comparison move onto the device, since both are simple calculations.
- The scheduled emails (weekly digest, overspend alerts) cannot read encrypted data because there is no device present when a scheduled job runs. For encrypted households these become device-triggered or are turned off. This is a real trade-off to confirm.

So the honest, user-facing sentence becomes: "Nothing readable is ever stored on our side. The only moment your numbers touch our servers is while you are actively using the AI, and we do not keep them."

## Migrating the data you already have

Our servers cannot encrypt your existing data, because they have no key. So each household is upgraded by a member's own device, once:

1. On the next login after this ships, the household owner is asked to set the household word and is shown the recovery code to save.
2. The device creates the hidden data key and stores its locked versions plus the salt.
3. The device reads all of that household's current amounts, encrypts them, writes them back, and marks the household as encrypted.
4. Other members simply enter the word the next time they open the app and immediately see everything, because the shared data was already encrypted once by the owner.

During the rollout, some households are encrypted and some are not yet, so the app carries a per-household "encrypted" flag and reads and writes the right way for each until everyone has migrated. Shared households are migrated exactly once by whichever member does it first, and every member keeps access through the shared word.

## Losing or changing the key

- **Change the word on purpose:** the hidden data key is simply re-locked with the new word. Instant, no data is touched. Then tell the other members the new word.
- **Forgot the word, have the recovery code:** unlock with the recovery code and set a new word. The user can do this themselves and we guide them. We never see anything.
- **Lost both:** unrecoverable by anyone, including us. We can help set up a fresh key, but the old data is gone. This is the cost of the guarantee, and it is worth stating kindly and clearly in the app.
- **Removing a member who knew the word:** they lose future access, but a person who already knew the word could still read data they had. To fully cut them off you would rotate to a brand new key and re-encrypt everything, which is heavier and optional. For a small trusted beta this is fine to defer.

## What the team can and cannot see (be honest with testers)

- Cannot see: any amount, in the live database, in exports, or in backups.
- Can see, only briefly and never stored: the bundle your device sends while you are actively using the coach or AI capture.

## Rollout phases (implementation order)

- **E1, crypto foundation.** A small client crypto module (Argon2id stretching, AES-256-GCM, the lock-and-unlock envelope). A `household_keys` table holding the salt and the locked key blobs. The set-your-key and save-your-recovery-code screens. Unlocking on login and caching the unlocked key for the session per device.
- **E2, encrypted data layer.** Route every amount read and write through encrypt and decrypt helpers. Add the per-household `encrypted` flag and keep the plaintext path working for households not yet migrated.
- **E3, migration.** The owner-driven, device-side encryption pass with progress and safe re-runs, plus shared-household handling.
- **E4, backend features.** Coach and AI capture receive the client context bundle instead of reading the database. Move baseline and benchmarks to the device. Rework or disable the scheduled emails for encrypted households.
- **E5, key management and polish.** Change word, recover with code, optional key rotation, the honest in-app copy, and a short wiki section that explains the home-key idea.

## Decisions to confirm before building

1. Encrypt amounts only, or also notes and merchant names.
2. Keep the scheduled digest and alert emails as device-triggered, or accept turning them off for encrypted households.
3. Require the recovery code to be saved during setup (recommended), or make it optional.
4. Confirm the easy-word plus Argon2id balance is acceptable, knowing it raises the cost of an attack a lot but does not make a common word unbreakable.

## Honest note on effort

This is the single largest change in the app. It touches how every amount is read and written, the coach and AI flows, the baseline and benchmark calculations, the scheduled emails, and a one-time migration. It is a multi-phase project, not a quick change. The upside is that it delivers the exact promise you want to make to your users, truthfully.
