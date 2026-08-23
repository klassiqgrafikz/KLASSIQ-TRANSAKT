/* Reset a user's password directly in the database.
 * Usage: node --env-file=apps/web/.env scripts/reset-password.cjs <email> <new-password>
 */
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const [email, newPassword] = process.argv.slice(2);
  if (!email || !newPassword) {
    console.error('Usage: node scripts/reset-password.cjs <email> <new-password>');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user found: ${email}`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { email },
    data: { passwordHash, status: 'ACTIVE' },
  });

  // Verify round-trip
  const fresh = await prisma.user.findUnique({ where: { email } });
  const ok = await bcrypt.compare(newPassword, fresh.passwordHash);

  console.log(ok
    ? `✅ Password reset OK for ${email} (status: ${fresh.status}, role: ${fresh.role})`
    : '❌ Verification failed — hash mismatch');
  if (!ok) process.exit(1);
}

main()
  .catch(e => { console.error('RESET ERROR:', e.message.slice(0, 300)); process.exit(1); })
  .finally(() => prisma.$disconnect());