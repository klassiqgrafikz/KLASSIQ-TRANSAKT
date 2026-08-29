/**
 * Backfill Quidax sub-accounts for existing platform users.
 * Run: npx tsx scripts/backfill-quidax-subaccounts.ts
 * Or via node after build.
 */
import { prisma } from '../packages/db/src';
import { exchangeService } from '../packages/exchange/src';

async function main() {
  const users = await prisma.user.findMany({
    where: { quidaxSubAccountId: null, role: { not: 'ADMIN' } },
    select: { id: true, email: true, name: true },
  });

  console.log(`Found ${users.length} users without sub-account (non-admin)`);

  for (const u of users) {
    try {
      const subId = await exchangeService.provisionSubAccountForUser(u.id);
      console.log(`✓ ${u.email} -> ${subId}`);
    } catch (e) {
      console.error(`✗ ${u.email} failed:`, e instanceof Error ? e.message : String(e));
    }
  }

  const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
  console.log(`Admin users (${adminCount}) keep merchant principal — no sub-account created.`);

  console.log('Backfill complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
