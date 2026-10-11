import { timeString } from '../../../domain/dates.js';
import type { WeekTemplate, WeekTemplateItem } from '../../../generated/prisma/client.js';

export function serialize(
    template: WeekTemplate & {
        items: WeekTemplateItem[];
    },
) {
    return {
        ...template,
        items: template.items.map((item) => ({
            ...item,
            startTime: timeString(item.startTime),
            endTime: timeString(item.endTime),
        })),
    };
}
