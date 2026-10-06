import { prisma } from './lib/prisma';

async function main() {
  const reqs = await prisma.requester.findMany({
    where: { email: { contains: 'luiseduardo' } }
  });
  console.log(reqs);
  
  const byId = await prisma.requester.findUnique({
    where: { id: 'a07d9910-169c-4fe5-a491-2d300725e385' }
  });
  console.log('ById:', byId);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
