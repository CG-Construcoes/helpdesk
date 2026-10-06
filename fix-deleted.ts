import { prisma } from './lib/prisma';

async function main() {
  const deleted = await prisma.requester.findMany({
    where: { deletedAt: { not: null } }
  });
  console.log(`Found ${deleted.length} deleted requesters.`);
  for (const req of deleted) {
    if (!req.email.includes('.deleted.')) {
      const newEmail = `${req.email}.deleted.${Date.now()}`;
      await prisma.requester.update({
        where: { id: req.id },
        data: { email: newEmail }
      });
      console.log(`Updated ${req.email} to ${newEmail}`);
    }
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
