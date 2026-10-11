import bcrypt from 'bcryptjs';
import prisma from '../prisma/index.js';
import { env } from '../config/env.js';
import { passwordSchema } from '../schemas/common.schema.js';

try {
    const existing = await prisma.user.findUnique({ where: { singletonKey: 1 } });
    if (existing) console.info('Usuário já existe; a senha foi preservada.');
    else {
        const password = passwordSchema.parse(process.env.ADMIN_PASSWORD);
        if (password.startsWith('replace-'))
            throw new Error('Defina ADMIN_PASSWORD antes de executar o seed.');
        await prisma.user.upsert({
            where: { singletonKey: 1 },
            update: {},
            create: {
                passwordHash: await bcrypt.hash(password, 12),
                timezone: env.TIMEZONE,
            },
        });
        console.info('Usuário pessoal configurado.');
    }
} finally {
    await prisma.$disconnect();
}
