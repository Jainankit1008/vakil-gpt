import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import Database from 'better-sqlite3';

// 1. Initialize the physical driver
const db = new Database('dev.db');

// 2. Initialize the Prisma Adapter
const adapter = new PrismaBetterSqlite3({
  url: 'file:./dev.db',
  adapter: db 
});

// 3. Initialize the Client with the adapter
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  // Create a dummy user
  const user = await prisma.user.create({
    data: {
      email: 'test@vakilgpt.com',
      name: 'First User',
      chats: {
        create: {
          content: 'Is this rental agreement valid?'
        }
      }
    }
  });

  console.log("✅ Created User:", user);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });