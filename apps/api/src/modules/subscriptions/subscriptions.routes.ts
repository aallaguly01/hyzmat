import type { FastifyInstance } from 'fastify';
import { IdParam } from '@hyzmat/shared';
import { parseOrThrow } from '../../lib/validate';
import type { SubscriptionsService } from './subscriptions.service';

export function subscriptionsRoutes(app: FastifyInstance, service: SubscriptionsService) {
  app.get('/subscriptions', (req) => service.list(req.user));

  app.post('/subscriptions', async (req, reply) => {
    const { dto, created } = await service.create(req.body, req.user);
    return reply.code(created ? 201 : 200).send(dto);
  });

  app.delete('/subscriptions/:id', async (req, reply) => {
    const { id } = parseOrThrow(IdParam, req.params);
    await service.remove(id, req.user);
    return reply.code(204).send();
  });
}
