import { assertTimeRange } from '../../../domain/activity.js';
import { parseTime } from '../../../domain/dates.js';
import type { TemplateInput } from '../../../schemas/template.schema.js';

export function itemData(item: TemplateInput['items'][number]) {
    const startTime = parseTime(item.startTime),
        endTime = parseTime(item.endTime);
    assertTimeRange(startTime, endTime);
    return {
        weekday: item.weekday,
        type: item.type,
        title: item.title,
        description: item.description,
        startTime,
        endTime,
    };
}
