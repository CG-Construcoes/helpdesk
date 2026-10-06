import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const users = await prisma.requester.findMany({
    where: { email: 'luiseduardo@cgconstrucoes.com' }
  })
  console.log('Requesters with this email:', users)
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect())
