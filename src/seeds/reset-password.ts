import bcrypt from 'bcryptjs';
import prisma from '../prisma/index.js';
import { passwordSchema } from '../schemas/common.schema.js';

try {
    const password = passwordSchema.parse(process.env.ADMIN_PASSWORD);
    if (password.startsWith('replace-')) throw new Error('Defina uma nova ADMIN_PASSWORD.');
    await prisma.user.update({
        where: { singletonKey: 1 },
        data: {
            passwordHash: await bcrypt.hash(password, 12),
            tokenVersion: { increment: 1 },
        },
    });
    console.info('Senha redefinida; tokens anteriores foram invalidados.');
} finally {
    await prisma.$disconnect();
}
