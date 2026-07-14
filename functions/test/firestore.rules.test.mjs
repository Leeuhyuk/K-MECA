import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc
} from 'firebase/firestore';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const projectId = 'demo-k-meca';
let testEnv;

const users = {
  admin: { uid: 'admin-user', email: 'admin@example.com', role: 'admin', active: true },
  manager: { uid: 'manager-user', email: 'manager@example.com', role: 'manager', active: true },
  staff: { uid: 'staff-user', email: 'staff@example.com', role: 'staff', active: true },
  pending: { uid: 'pending-user', email: 'pending@example.com', role: 'staff', active: false },
  legacy: { uid: 'legacy-user', email: 'legacy@example.com', role: 'staff' }
};

function authDb(user) {
  return testEnv.authenticatedContext(user.uid, { email: user.email }).firestore();
}

async function seedBaseData() {
  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    for (const user of Object.values(users)) {
      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        name: user.uid,
        role: user.role,
        ...(Object.hasOwn(user, 'active') ? { active: user.active } : {}),
        createdAt: 1
      });
    }
  });
}

before(async () => {
  const rules = await readFile(path.join(repoRoot, 'firestore.rules'), 'utf8');
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules }
  });
});

after(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seedBaseData();
});

test('new users can only self-register as inactive staff with approved fields', async () => {
  const uid = 'new-user';
  const email = 'new@example.com';
  const db = testEnv.authenticatedContext(uid, { email }).firestore();
  const ref = doc(db, 'users', uid);

  await assertFails(setDoc(ref, {
    email,
    name: 'New User',
    role: 'admin',
    active: true,
    createdAt: Date.now()
  }));

  await assertSucceeds(setDoc(ref, {
    email,
    name: 'New User',
    role: 'staff',
    active: false,
    createdAt: Date.now()
  }));
});

test('self-registration rejects extra fields and another account email', async () => {
  const uid = 'new-user';
  const email = 'new@example.com';
  const db = testEnv.authenticatedContext(uid, { email }).firestore();

  await assertFails(setDoc(doc(db, 'users', uid), {
    email: 'other@example.com',
    name: 'New User',
    role: 'staff',
    active: false,
    createdAt: Date.now()
  }));

  await assertFails(setDoc(doc(db, 'users', uid), {
    email,
    name: 'New User',
    role: 'staff',
    active: false,
    createdAt: Date.now(),
    permissions: ['admin']
  }));
});

test('pending users can read their own approval state but cannot activate themselves', async () => {
  const db = authDb(users.pending);
  await assertSucceeds(getDoc(doc(db, 'users', users.pending.uid)));
  await assertFails(updateDoc(doc(db, 'users', users.pending.uid), { active: true }));
  await assertSucceeds(updateDoc(doc(db, 'users', users.pending.uid), { name: 'Pending User' }));
});

test('legacy accounts without active true cannot access ERP data', async () => {
  const db = authDb(users.legacy);
  await assertFails(getDoc(doc(db, 'mes_v2', 'inventory')));
  await assertFails(setDoc(doc(db, 'mes_v2', 'inventory'), { mode: 'legacy-write' }));
});

test('active staff can write operational data but not finance or direct audit data', async () => {
  const db = authDb(users.staff);
  await assertSucceeds(setDoc(doc(db, 'mes_v2', 'inventory'), { mode: 'operational' }));
  await assertFails(setDoc(doc(db, 'mes_v2', 'financeData'), { mode: 'finance' }));
  await assertFails(setDoc(doc(db, 'mes_v2', 'auditLog'), { mode: 'spoof' }));
});

test('staff cannot read finance or HR data, but operational data stays readable', async () => {
  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'mes_v2', 'inventory'), { seeded: true });
    for (const key of ['financeData', 'workers', 'attendance', 'leaves', 'payrollRecords']) {
      await setDoc(doc(db, 'mes_v2', key), { seeded: true });
      await setDoc(doc(db, 'mes_v2', key, 'state', 'current'), { seeded: true });
      await setDoc(doc(db, 'mes_v2', key, 'items', 'row-1'), { seeded: true });
    }
  });

  const staffDb = authDb(users.staff);
  await assertSucceeds(getDoc(doc(staffDb, 'mes_v2', 'inventory')));
  for (const key of ['financeData', 'workers', 'attendance', 'leaves', 'payrollRecords']) {
    await assertFails(getDoc(doc(staffDb, 'mes_v2', key)));
    await assertFails(getDoc(doc(staffDb, 'mes_v2', key, 'state', 'current')));
    await assertFails(getDoc(doc(staffDb, 'mes_v2', key, 'items', 'row-1')));
  }

  const managerDb = authDb(users.manager);
  await assertSucceeds(getDoc(doc(managerDb, 'mes_v2', 'payrollRecords')));
  await assertSucceeds(getDoc(doc(managerDb, 'mes_v2', 'financeData', 'state', 'current')));
});

test('manager can write finance data but admin-only settings stay protected', async () => {
  const managerDb = authDb(users.manager);
  const adminDb = authDb(users.admin);

  await assertSucceeds(setDoc(doc(managerDb, 'mes_v2', 'financeData'), { mode: 'manager' }));
  await assertFails(setDoc(doc(managerDb, 'mes_v2', 'companyInfo'), { name: 'spoof' }));
  await assertSucceeds(setDoc(doc(adminDb, 'mes_v2', 'companyInfo'), { name: 'approved' }));
});

test('audit entries require the authenticated uid, trusted role, and server timestamp', async () => {
  const db = authDb(users.staff);

  await assertSucceeds(setDoc(doc(db, 'audit_logs', 'AUD-OK'), {
    id: 'AUD-OK',
    actorUserId: users.staff.uid,
    actorRole: 'staff',
    action: 'update',
    serverAt: serverTimestamp()
  }));

  await assertFails(setDoc(doc(db, 'audit_logs', 'AUD-SPOOF'), {
    id: 'AUD-SPOOF',
    actorUserId: users.admin.uid,
    actorRole: 'admin',
    action: 'delete',
    serverAt: serverTimestamp()
  }));

  await assertFails(setDoc(doc(db, 'audit_logs', 'AUD-LOCAL-TIME'), {
    id: 'AUD-LOCAL-TIME',
    actorUserId: users.staff.uid,
    actorRole: 'staff',
    action: 'update',
    serverAt: new Date().toISOString()
  }));
});

test('rule test environment is connected to the expected demo project', () => {
  assert.equal(testEnv.projectId, projectId);
});
