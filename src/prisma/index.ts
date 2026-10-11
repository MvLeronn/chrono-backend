import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../config/env.js';

const url = new URL(env.DATABASE_URL);
const schema = url.searchParams.get('schema') ?? 'public';
url.searchParams.delete('schema');
const adapter = new PrismaPg({ connectionString: url.toString() }, { schema });
const prismaClient = new PrismaClient({ adapter });
export default prismaClient;
