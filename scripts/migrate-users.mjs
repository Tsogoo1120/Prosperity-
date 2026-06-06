/**
 * DB-to-DB user migration script.
 * Migrates: auth.users, auth.identities, profiles, payments, test_results, lesson_progress
 * Passwords are preserved (encrypted_password copied directly).
 *
 * Usage:
 *   node scripts/migrate-users.mjs
 *
 * Requires: npm install pg
 */

import pg from 'pg';
const { Client } = pg;

// ── CONFIGURE THESE ──────────────────────────────────────────────────────────
// Get from: Supabase Dashboard → Connect → Session pooler (IPv4-compatible).
// Direct db.[PROJECT-REF].supabase.co hostnames are IPv6-only and fail on many
// Windows/home networks with ENOTFOUND.
// Format: postgresql://postgres.[PROJECT-REF]:[DB-PASSWORD]@aws-[N]-[REGION].pooler.supabase.com:5432/postgres
const OLD_DB = 'postgresql://postgres.bqpdqfpxjoijugfcjidu:Raccoon%4098112031@aws-1-ap-south-1.pooler.supabase.com:5432/postgres';
const NEW_DB = 'postgresql://postgres.gtewmyhzpuwzmkdtgink:Raccoon98112031@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres';
// ─────────────────────────────────────────────────────────────────────────────

const SSL = { rejectUnauthorized: false };

async function connect(connStr, label) {
  const client = new Client({ connectionString: connStr, ssl: SSL });
  await client.connect();
  console.log(`Connected: ${label}`);
  return client;
}

async function tableExists(client, table) {
  const [schema, name] = table.split('.');
  const { rows } = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2`,
    [schema, name],
  );
  return rows.length > 0;
}

async function migrate() {
  const src = await connect(OLD_DB, 'OLD project');
  const dst = await connect(NEW_DB, 'NEW project');

  try {
    // ── 1. auth.users ────────────────────────────────────────────────────────
    console.log('\n[1/6] Migrating auth.users...');
    const { rows: users } = await src.query(`
      SELECT id, instance_id, aud, role, email, encrypted_password,
             email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at,
             recovery_token, recovery_sent_at, email_change_token_new, email_change,
             email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
             is_super_admin, created_at, updated_at, phone, phone_confirmed_at,
             phone_change, phone_change_token, phone_change_sent_at,
             email_change_token_current, email_change_confirm_status,
             banned_until, reauthentication_token, reauthentication_sent_at,
             is_sso_user, deleted_at, is_anonymous
      FROM auth.users
      WHERE deleted_at IS NULL AND is_anonymous = false
    `);
    console.log(`  Found ${users.length} users`);

    // Trigger on_auth_user_created will fire and create profiles;
    // step 3 upserts over them with correct data from old DB.
    let inserted = 0;
    for (const u of users) {
      const res = await dst.query(`
        INSERT INTO auth.users (
          id, instance_id, aud, role, email, encrypted_password,
          email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at,
          recovery_token, recovery_sent_at, email_change_token_new, email_change,
          email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
          is_super_admin, created_at, updated_at, phone, phone_confirmed_at,
          phone_change, phone_change_token, phone_change_sent_at,
          email_change_token_current, email_change_confirm_status,
          banned_until, reauthentication_token, reauthentication_sent_at,
          is_sso_user, deleted_at, is_anonymous
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
          $17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34
        ) ON CONFLICT (id) DO NOTHING
      `, [
        u.id, u.instance_id, u.aud, u.role, u.email, u.encrypted_password,
        u.email_confirmed_at, u.invited_at, u.confirmation_token, u.confirmation_sent_at,
        u.recovery_token, u.recovery_sent_at, u.email_change_token_new, u.email_change,
        u.email_change_sent_at, u.last_sign_in_at, u.raw_app_meta_data, u.raw_user_meta_data,
        u.is_super_admin, u.created_at, u.updated_at, u.phone, u.phone_confirmed_at,
        u.phone_change, u.phone_change_token, u.phone_change_sent_at,
        u.email_change_token_current, u.email_change_confirm_status,
        u.banned_until, u.reauthentication_token, u.reauthentication_sent_at,
        u.is_sso_user, u.deleted_at, u.is_anonymous,
      ]);
      if (res.rowCount > 0) inserted++;
    }
    console.log(`  Done: ${inserted} inserted, ${users.length - inserted} skipped (already exist)`);

    // ── 2. auth.identities ───────────────────────────────────────────────────
    console.log('\n[2/6] Migrating auth.identities...');
    const { rows: identities } = await src.query(`
      SELECT id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
      FROM auth.identities
      WHERE user_id = ANY($1::uuid[])
    `, [users.map(u => u.id)]);
    console.log(`  Found ${identities.length} identities`);

    let idInserted = 0;
    for (const i of identities) {
      const res = await dst.query(`
        INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (id) DO NOTHING
      `, [i.id, i.user_id, i.provider_id, i.identity_data, i.provider, i.last_sign_in_at, i.created_at, i.updated_at]);
      if (res.rowCount > 0) idInserted++;
    }
    console.log(`  Done: ${idInserted} inserted`);

    // ── 3. public.profiles ───────────────────────────────────────────────────
    console.log('\n[3/6] Migrating public.profiles...');
    const { rows: profiles } = await src.query('SELECT * FROM public.profiles');
    console.log(`  Found ${profiles.length} profiles`);

    let profInserted = 0;
    for (const p of profiles) {
      const res = await dst.query(`
        INSERT INTO public.profiles (
          id, full_name, email, phone, avatar_url, role,
          subscription_status, subscription_expires_at, expiry_reminder_stage,
          is_admin, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT (id) DO UPDATE SET
          full_name             = EXCLUDED.full_name,
          email                 = EXCLUDED.email,
          phone                 = EXCLUDED.phone,
          avatar_url            = EXCLUDED.avatar_url,
          role                  = EXCLUDED.role,
          subscription_status   = EXCLUDED.subscription_status,
          subscription_expires_at = EXCLUDED.subscription_expires_at,
          expiry_reminder_stage = EXCLUDED.expiry_reminder_stage,
          is_admin              = EXCLUDED.is_admin
      `, [
        p.id, p.full_name, p.email, p.phone, p.avatar_url, p.role,
        p.subscription_status, p.subscription_expires_at, p.expiry_reminder_stage,
        p.is_admin ?? false, p.created_at,
      ]);
      if (res.rowCount > 0) profInserted++;
    }
    console.log(`  Done: ${profInserted} upserted`);

    // ── 4. public.payments ───────────────────────────────────────────────────
    console.log('\n[4/6] Migrating public.payments...');
    const { rows: payments } = await src.query('SELECT * FROM public.payments');
    console.log(`  Found ${payments.length} payments`);

    let payInserted = 0, paySkipped = 0;
    for (const p of payments) {
      try {
        const res = await dst.query(`
          INSERT INTO public.payments (
            id, user_id, screenshot_path, amount, currency, status,
            service_type, bank_reference, reviewed_by, reviewed_at, created_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,COALESCE($11, now()))
          ON CONFLICT (id) DO NOTHING
        `, [
          p.id, p.user_id, p.screenshot_path, p.amount, p.currency, p.status,
          p.service_type, p.bank_reference, p.reviewed_by, p.reviewed_at, p.created_at,
        ]);
        if (res.rowCount > 0) payInserted++; else paySkipped++;
      } catch (e) {
        console.warn(`  WARN payment ${p.id}: ${e.message}`);
        paySkipped++;
      }
    }
    console.log(`  Done: ${payInserted} inserted, ${paySkipped} skipped`);

    // ── 5. public.test_results ───────────────────────────────────────────────
    console.log('\n[5/6] Migrating public.test_results...');
    const { rows: testResults } = await src.query('SELECT * FROM public.test_results');
    console.log(`  Found ${testResults.length} test results`);

    let trInserted = 0, trSkipped = 0;
    for (const r of testResults) {
      try {
        const res = await dst.query(`
          INSERT INTO public.test_results (id, user_id, test_id, answers, result_summary, score, created_at)
          VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7, now()))
          ON CONFLICT (id) DO NOTHING
        `, [r.id, r.user_id, r.test_id, r.answers ?? {}, r.result_summary, r.score, r.created_at]);
        if (res.rowCount > 0) trInserted++; else trSkipped++;
      } catch (e) {
        console.warn(`  WARN test_result ${r.id}: ${e.message}`);
        trSkipped++;
      }
    }
    console.log(`  Done: ${trInserted} inserted, ${trSkipped} skipped`);

    // ── 6. public.lesson_progress ────────────────────────────────────────────
    console.log('\n[6/6] Migrating public.lesson_progress...');
    let progress = [];
    if (await tableExists(src, 'public.lesson_progress')) {
      ({ rows: progress } = await src.query('SELECT * FROM public.lesson_progress'));
    } else {
      console.log('  Skipped: table does not exist in OLD project');
    }
    console.log(`  Found ${progress.length} lesson progress rows`);

    let lpInserted = 0, lpSkipped = 0;
    for (const lp of progress) {
      try {
        const res = await dst.query(`
          INSERT INTO public.lesson_progress (id, user_id, lesson_id, created_at)
          VALUES ($1,$2,$3,COALESCE($4, now()))
          ON CONFLICT (id) DO NOTHING
        `, [lp.id, lp.user_id, lp.lesson_id, lp.created_at]);
        if (res.rowCount > 0) lpInserted++; else lpSkipped++;
      } catch (e) {
        console.warn(`  WARN lesson_progress ${lp.id}: ${e.message}`);
        lpSkipped++;
      }
    }
    console.log(`  Done: ${lpInserted} inserted, ${lpSkipped} skipped`);

    console.log('\n✅ Migration complete!');
    console.log('   Users can log in with their existing passwords.');

  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    throw err;
  } finally {
    await src.end();
    await dst.end();
  }
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
