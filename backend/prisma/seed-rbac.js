const prisma = require('../src/lib/prisma');
const { ROLE_PERMISSIONS } = require('../src/lib/permissions');

async function main() {
  const users = await prisma.user.findMany();
  for (const user of users) {
    const perms = ROLE_PERMISSIONS[user.role] || ROLE_PERMISSIONS.cashier;
    await prisma.user.update({
      where: { id: user.id },
      data: { permissions: JSON.stringify(perms) },
    });
    console.log(`Updated ${user.name} (${user.role}): ${perms.length} permissions`);
  }
  console.log('RBAC seed complete');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
