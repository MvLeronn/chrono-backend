import { Router } from 'express';
import { CreateWeekTemplateController } from '../controllers/week-template/create-week-template.controller.js';
import { validateSchema } from '../middlewares/validate-schema.js';
import {
    createTemplateSchema,
    updateTemplateSchema,
    applyTemplateSchema,
} from '../schemas/template.schema.js';
import { GetWeekTemplateController } from '../controllers/week-template/get-week-template.controller.js';
import { idSchema, listSchema } from '../schemas/common.schema.js';
import { ListWeekTemplatesController } from '../controllers/week-template/list-week-templates.controller.js';
import { UpdateWeekTemplateController } from '../controllers/week-template/update-week-template.controller.js';
import { ArchiveWeekTemplateController } from '../controllers/week-template/archive-week-template.controller.js';
import { ApplyWeekTemplateController } from '../controllers/week-template/apply-week-template.controller.js';

const weekTemplateRoutes = Router();

weekTemplateRoutes.post(
    '/',
    validateSchema(createTemplateSchema),
    new CreateWeekTemplateController().handle,
);

weekTemplateRoutes.get('/:id', validateSchema(idSchema), new GetWeekTemplateController().handle);

weekTemplateRoutes.get('/', validateSchema(listSchema), new ListWeekTemplatesController().handle);

weekTemplateRoutes.patch(
    '/:id',
    validateSchema(updateTemplateSchema),
    new UpdateWeekTemplateController().handle,
);

weekTemplateRoutes.delete(
    '/:id',
    validateSchema(idSchema),
    new ArchiveWeekTemplateController().handle,
);

weekTemplateRoutes.post(
    '/:id/apply',
    validateSchema(applyTemplateSchema),
    new ApplyWeekTemplateController().handle,
);

export default weekTemplateRoutes;
