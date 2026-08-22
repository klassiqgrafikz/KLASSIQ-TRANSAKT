/* Seed script: creates the platform owner (ADMIN) and a first invite.
 * Usage: node scripts/seed-admin.cjs <admin-email> <admin-password> <invite-email>
 */
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const [email, password, inviteEmail] = process.argv.slice(2);

  if (!email || !password) {
    console.error('Usage: node scripts/seed-admin.cjs <admin-email> <admin-password> [invite-email|"-"]');
    process.exit(1);
  }

  // 1. Create or promote ADMIN user
  const existing = await prisma.user.findUnique({ where: { email } });
  let admin;
  if (existing) {
    admin = await prisma.user.update({
      where: { email },
      data: { role: 'ADMIN', status: 'ACTIVE' },
    });
    console.log(`Promoted existing user to ADMIN: ${email}`);
  } else {
    const passwordHash = await bcrypt.hash(password, 12);
    admin = await prisma.user.create({
      data: {
        email,
        name: 'KLASSIQ Admin',
        passwordHash,
        role: 'ADMIN',
        status: 'ACTIVE',
        kycLevel: 'FULL',
        emailVerified: new Date(),
      },
    });
    console.log(`Created ADMIN user: ${email}`);
  }

  // 2. Create first invite for a new user (optional)
  let invite = null;
  if (inviteEmail && inviteEmail !== '-') {
    const code = `KT-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const dup = await prisma.invite.findUnique({ where: { email: inviteEmail } });
    if (dup && !dup.usedBy) {
      invite = dup;
      console.log('Active invite already exists for', inviteEmail);
    } else {
      invite = await prisma.invite.create({
        data: { code, email: inviteEmail, role: 'USER', expiresAt, createdBy: admin.id },
      });
      console.log(`Created invite for ${inviteEmail}`);
    }
  }

  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: 'SEED_ADMIN',
      entity: 'User',
      entityId: admin.id,
      after: { seededBy: 'seed-script' },
    },
  });

  console.log('\n=== RESULTS ===');
  console.log(`Admin login : ${email} (password you provided)`);
  if (invite) {
    console.log(`Invite code : ${invite.code}`);
    console.log(`Invite link : ${process.env.NEXTAUTH_URL || 'http://localhost:3001'}/auth/accept-invite/${invite.code}`);
  }
}

main()
  .catch(e => { console.error('SEED ERROR:', e.message.slice(0, 300)); process.exit(1); })
  .finally(() => prisma.$disconnect());